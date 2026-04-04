package com.example.swiftcause.presentation.viewmodels

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.swiftcause.data.terminal.TapToPayRepository
import com.stripe.stripeterminal.external.models.PaymentIntent
import com.stripe.stripeterminal.external.models.Reader
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class TapToPayState {
    object Idle : TapToPayState()
    object Initializing : TapToPayState()
    object DiscoveringReaders : TapToPayState()
    data class ReadersFound(val readers: List<Reader>) : TapToPayState()
    object ConnectingReader : TapToPayState()
    data class ReaderConnected(val reader: Reader) : TapToPayState()
    object WaitingForCard : TapToPayState()
    object ProcessingPayment : TapToPayState()
    data class PaymentSuccess(val paymentIntent: PaymentIntent) : TapToPayState()
    data class Error(val message: String) : TapToPayState()
}

class TapToPayViewModel(application: Application) : AndroidViewModel(application) {
    private val TAG = "TapToPayViewModel"
    private val repository = TapToPayRepository(application)

    private val _state = MutableStateFlow<TapToPayState>(TapToPayState.Idle)
    val state: StateFlow<TapToPayState> = _state.asStateFlow()

    private var currentPaymentClientSecret: String? = null

    /**
     * Initialize and setup Tap to Pay
     */
    fun initializeTapToPay(isSimulated: Boolean = false) {
        viewModelScope.launch {
            try {
                _state.value = TapToPayState.Initializing
                Log.d(TAG, "Initializing Terminal SDK...")

                repository.initialize().getOrThrow()
                Log.d(TAG, "Terminal SDK initialized, discovering readers...")

                _state.value = TapToPayState.DiscoveringReaders
                val readers = repository.discoverReaders(isSimulated).getOrThrow()

                if (readers.isEmpty()) {
                    _state.value = TapToPayState.Error("No Tap to Pay readers found")
                    return@launch
                }

                Log.d(TAG, "Found ${readers.size} readers")
                val reader = readers.first()

                _state.value = TapToPayState.ConnectingReader
                // For simulated readers, use "tml_simulated" as locationId
                // For production, you'd get this from your backend
                val locationId = if (isSimulated) "tml_simulated" else "tml_simulated"
                val connectedReader = repository.connectReader(reader, locationId).getOrThrow()

                _state.value = TapToPayState.ReaderConnected(connectedReader)
                Log.d(TAG, "Reader connected: ${connectedReader.serialNumber}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize Tap to Pay", e)
                _state.value = TapToPayState.Error(e.message ?: "Failed to initialize")
            }
        }
    }

    /**
     * Start payment collection with Tap to Pay
     */
    fun collectPayment(clientSecret: String) {
        currentPaymentClientSecret = clientSecret
        viewModelScope.launch {
            try {
                _state.value = TapToPayState.WaitingForCard
                Log.d(TAG, "Waiting for card tap...")

                val collectedIntent = repository.collectPaymentMethod(clientSecret).getOrThrow()
                Log.d(TAG, "Card tapped, processing payment...")

                _state.value = TapToPayState.ProcessingPayment
                val processedIntent = repository.processPayment(collectedIntent).getOrThrow()

                _state.value = TapToPayState.PaymentSuccess(processedIntent)
                Log.d(TAG, "Payment successful: ${processedIntent.id}")
            } catch (e: Exception) {
                Log.e(TAG, "Payment failed", e)
                _state.value = TapToPayState.Error(e.message ?: "Payment failed")
            }
        }
    }

    /**
     * Reset to idle state
     */
    fun reset() {
        _state.value = TapToPayState.Idle
        currentPaymentClientSecret = null
    }

    /**
     * Check if reader is ready for payment
     */
    fun isReaderReady(): Boolean {
        return _state.value is TapToPayState.ReaderConnected
    }

    override fun onCleared() {
        super.onCleared()
        viewModelScope.launch {
            try {
                if (repository.isReaderConnected()) {
                    repository.disconnectReader()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error disconnecting reader", e)
            }
        }
    }
}
