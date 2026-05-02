package com.example.swiftcause.presentation.viewmodels

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.swiftcause.data.models.*
import com.example.swiftcause.data.repository.PaymentRepository
import com.google.firebase.firestore.FirebaseFirestore
import com.stripe.android.paymentsheet.PaymentSheetResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * ViewModel for managing payment flow and state
 */
class PaymentViewModel(
    private val paymentRepository: PaymentRepository = PaymentRepository()
) : ViewModel() {

    companion object {
        private const val TAG = "PaymentViewModel"
    }

    // Payment state
    private val _paymentState = MutableStateFlow<PaymentState>(PaymentState.Idle)
    val paymentState: StateFlow<PaymentState> = _paymentState.asStateFlow()

    // Client secret for PaymentSheet
    private val _clientSecret = MutableStateFlow<String?>(null)
    val clientSecret: StateFlow<String?> = _clientSecret.asStateFlow()

    // Magic link token for QR code
    private val _magicLinkToken = MutableStateFlow<String?>(null)
    val magicLinkToken: StateFlow<String?> = _magicLinkToken.asStateFlow()

    // Whether current PaymentSheet presentation should use SetupIntent flow
    private val _isSetupIntentFlow = MutableStateFlow(false)
    val isSetupIntentFlow: StateFlow<Boolean> = _isSetupIntentFlow.asStateFlow()

    private var amount: Long = 0
    private var currency: String = ""
    private var paymentIntentId: String = ""
    private var magicLinkPollingJob: Job? = null
    private var pendingRequest: CreatePaymentIntentRequest? = null
    private var paymentSheetFlowMode: PaymentSheetFlowMode = PaymentSheetFlowMode.PAYMENT_INTENT

    private val firestore = FirebaseFirestore.getInstance()

    /**
     * Creates a payment intent and prepares PaymentSheet
     */
    fun preparePayment(
        amount: Long,
        currency: String,
        campaignId: String,
        campaignTitle: String,
        organizationId: String,
        donorName: String? = null,
        donorEmail: String? = null,
        isAnonymous: Boolean = false,
        frequency: String? = null,  // null = one-time, "month", "year" = recurring
        intervalCount: Int? = null,
        isGiftAid: Boolean = false,  // Campaign has Gift Aid enabled
        kioskId: String? = null
    ) {
        this.amount = amount
        this.currency = currency
        viewModelScope.launch {
            try {
                _paymentState.value = PaymentState.Loading
                Log.d(TAG, "=== Preparing Payment ===")
                Log.d(TAG, "Amount: $amount cents (${amount / 100.0})")
                Log.d(TAG, "Currency: $currency")
                Log.d(TAG, "Campaign: $campaignTitle ($campaignId)")
                Log.d(TAG, "Organization ID: $organizationId")
                Log.d(TAG, "Is Recurring: ${frequency != null}")
                Log.d(TAG, "Frequency: $frequency")
                Log.d(TAG, "Interval Count: $intervalCount")
                Log.d(TAG, "Is Anonymous: $isAnonymous")
                Log.d(TAG, "Is Gift Aid: $isGiftAid")

                // Create payment intent request
                val request = CreatePaymentIntentRequest(
                    amount = amount,
                    currency = currency.lowercase(),
                    metadata = PaymentMetadata(
                        campaignId = campaignId,
                        campaignTitle = campaignTitle,
                        organizationId = organizationId,
                        platform = "android_kiosk",
                        kioskId = kioskId,
                        donorName = donorName,
                        donorEmail = donorEmail,
                        isAnonymous = isAnonymous,
                        isGiftAid = isGiftAid,
                        recurringInterest = frequency != null
                    ),
                    frequency = frequency,
                    intervalCount = intervalCount,
                    donor = if (!donorEmail.isNullOrBlank()) {
                        DonorInfo(
                            email = donorEmail,
                            name = donorName ?: "Anonymous"
                        )
                    } else null
                )

                pendingRequest = request

                Log.d(TAG, "Calling PaymentRepository.createPaymentIntent()")

                // Call backend to create payment intent
                val result = paymentRepository.createPaymentIntent(request)

                result.fold(
                    onSuccess = { response ->
                        Log.d(TAG, "Repository returned success")
                        if (response.setupIntentClientSecret != null) {
                            _clientSecret.value = response.setupIntentClientSecret
                            pendingRequest = pendingRequest?.copy(customerId = response.customerId)
                            paymentSheetFlowMode = PaymentSheetFlowMode.SETUP_INTENT
                            _isSetupIntentFlow.value = true
                            _paymentState.value = PaymentState.Ready
                            Log.d(TAG, "Recurring setup prepared - State: Ready")
                        } else if (response.clientSecret != null) {
                            _clientSecret.value = response.clientSecret
                            paymentIntentId = response.clientSecret.substringBeforeLast("_secret_")
                            paymentSheetFlowMode = PaymentSheetFlowMode.PAYMENT_INTENT
                            _isSetupIntentFlow.value = false
                            _paymentState.value = PaymentState.Ready
                            Log.d(TAG, "Payment prepared - State: Ready")
                            Log.d(TAG, "Client secret length: ${response.clientSecret.length}")
                        } else if (response.success == true) {
                            // Recurring payment succeeded immediately
                            Log.d(TAG, "Recurring payment succeeded immediately")
                            _paymentState.value = PaymentState.Success(
                                transactionId = response.subscriptionId ?: "",
                                amount = amount,
                                currency = currency
                            )
                        } else {
                            Log.e(TAG, "No client secret and not success: ${response.message}")
                            _paymentState.value = PaymentState.Error(
                                message = response.message ?: "Failed to prepare payment"
                            )
                        }
                    },
                    onFailure = { error ->
                        Log.e(TAG, "Repository returned failure")
                        Log.e(TAG, "Error: ${error.message}", error)
                        _paymentState.value = PaymentState.Error(
                            message = error.message ?: "Failed to prepare payment"
                        )
                    }
                )
            } catch (e: Exception) {
                Log.e(TAG, "Exception in preparePayment", e)
                _paymentState.value = PaymentState.Error(
                    message = e.message ?: "An unexpected error occurred"
                )
            }
        }
    }

    /**
     * Handles the result of the PaymentSheet
     */
    fun handlePaymentResult(result: PaymentSheetResult, onPaymentSuccess: () -> Unit) {
        viewModelScope.launch {
            when (result) {
                is PaymentSheetResult.Completed -> {
                    if (paymentSheetFlowMode == PaymentSheetFlowMode.SETUP_INTENT) {
                        Log.d(TAG, "SetupIntent completed; finalizing recurring subscription")
                        finalizeRecurringSubscription(onPaymentSuccess)
                    } else {
                        Log.d(TAG, "Payment completed")
                        _paymentState.value = PaymentState.Success(
                            transactionId = paymentIntentId,
                            amount = amount,
                            currency = currency
                        )
                        onPaymentSuccess()
                    }
                }
                is PaymentSheetResult.Canceled -> {
                    Log.d(TAG, "Payment canceled")
                    _paymentState.value = PaymentState.Cancelled
                }
                is PaymentSheetResult.Failed -> {
                    Log.e(TAG, "Payment failed: ${result.error.message}")
                    _paymentState.value = PaymentState.Error(
                        message = result.error.message ?: "Payment failed"
                    )
                }
            }
        }
    }

    /**
     * Resets payment state to idle
     */
    fun resetPayment() {
        _paymentState.value = PaymentState.Idle
        _clientSecret.value = null
        _magicLinkToken.value = null
        _isSetupIntentFlow.value = false
        this.amount = 0
        this.currency = ""
        this.paymentIntentId = ""
        this.pendingRequest = null
        this.paymentSheetFlowMode = PaymentSheetFlowMode.PAYMENT_INTENT
    }

    private suspend fun finalizeRecurringSubscription(onPaymentSuccess: () -> Unit) {
        try {
            val setupIntentClientSecret = _clientSecret.value
            val setupIntentId = setupIntentClientSecret?.substringBeforeLast("_secret_")
            val baseRequest = pendingRequest

            if (setupIntentId.isNullOrBlank() || baseRequest == null) {
                _paymentState.value = PaymentState.Error(
                    message = "Missing setup confirmation data for recurring donation"
                )
                return
            }

            _paymentState.value = PaymentState.Loading

            val finalizeRequest = baseRequest.copy(
                setupIntentId = setupIntentId,
                customerId = baseRequest.customerId
            )

            val result = paymentRepository.createPaymentIntent(finalizeRequest)
            result.fold(
                onSuccess = { response ->
                    if (response.clientSecret != null) {
                        _clientSecret.value = response.clientSecret
                        paymentIntentId = response.clientSecret.substringBeforeLast("_secret_")
                        paymentSheetFlowMode = PaymentSheetFlowMode.PAYMENT_INTENT
                        _isSetupIntentFlow.value = false
                        _paymentState.value = PaymentState.Ready
                    } else if (response.success == true) {
                        _paymentState.value = PaymentState.Success(
                            transactionId = response.subscriptionId ?: setupIntentId,
                            amount = amount,
                            currency = currency
                        )
                        onPaymentSuccess()
                    } else {
                        _paymentState.value = PaymentState.Error(
                            message = response.message ?: "Failed to finalize recurring subscription"
                        )
                    }
                },
                onFailure = { error ->
                    _paymentState.value = PaymentState.Error(
                        message = error.message ?: "Failed to finalize recurring subscription"
                    )
                }
            )
        } catch (e: Exception) {
            _paymentState.value = PaymentState.Error(
                message = e.message ?: "Failed to finalize recurring subscription"
            )
        }
    }

    /**
     * Fetches magic link token from Firestore ephemeral collection
     * Token is only available for 2 minutes after payment completion
     */
    fun fetchMagicLinkToken(paymentIntentId: String) {
        magicLinkPollingJob?.cancel()
        magicLinkPollingJob = viewModelScope.launch {
            try {
                Log.d(TAG, "Fetching magic link token for: $paymentIntentId")

                val docRef = firestore.collection("magicLinkEphemeral").document(paymentIntentId)
                val maxAttempts = 20
                val retryDelayMs = 1500L

                repeat(maxAttempts) { attempt ->
                    val snapshot = docRef.get().await()

                    if (snapshot.exists()) {
                        val plainToken = snapshot.getString("plainToken")
                        val expiresAt = snapshot.getTimestamp("expiresAt")

                        // Check if token is still valid (not expired)
                        val now = com.google.firebase.Timestamp.now()
                        if (plainToken != null && expiresAt != null && now < expiresAt) {
                            _magicLinkToken.value = plainToken
                            Log.d(TAG, "Magic link token fetched successfully on attempt ${attempt + 1}")
                            return@launch
                        }

                        Log.w(TAG, "Magic link token expired or invalid")
                        _magicLinkToken.value = null
                        return@launch
                    }

                    // Likely webhook race: token doc not written yet. Retry shortly.
                    if (attempt < maxAttempts - 1) {
                        delay(retryDelayMs)
                    }
                }

                Log.w(TAG, "No magic link token found after retries (webhook may be delayed or token not generated)")
                _magicLinkToken.value = null
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch magic link token", e)
                _magicLinkToken.value = null
            }
        }
    }
}

private enum class PaymentSheetFlowMode {
    PAYMENT_INTENT,
    SETUP_INTENT,
}

/**
 * Payment states
 */
sealed class PaymentState {
    object Idle : PaymentState()
    object Loading : PaymentState()
    object Ready : PaymentState()  // Payment intent created, ready to show PaymentSheet

    data class Success(
        val transactionId: String,
        val amount: Long,
        val currency: String
    ) : PaymentState()

    data class Error(
        val message: String
    ) : PaymentState()

    object Cancelled : PaymentState()
}
