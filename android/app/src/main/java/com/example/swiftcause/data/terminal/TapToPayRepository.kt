package com.example.swiftcause.data.terminal

import android.app.Application
import android.util.Log
import com.stripe.stripeterminal.Terminal
import com.stripe.stripeterminal.external.callable.*
import com.stripe.stripeterminal.external.models.*
import com.stripe.stripeterminal.log.LogLevel
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class TapToPayRepository(
    private val application: Application
) {
    private val TAG = "TapToPayRepository"
    
    private var currentReader: Reader? = null
    
    // Token provider and listener for Terminal
    private val tokenProvider = StripeConnectionTokenProvider()
    private val listener = object : TerminalListener {}

    /**
     * Initialize Terminal SDK
     * Based on official Stripe example: https://github.com/stripe/stripe-terminal-android
     */
    suspend fun initialize(): Result<Unit> {
        return try {
            // Initialize Terminal SDK if not already initialized
            if (!Terminal.isInitialized()) {
                Terminal.init(
                    application,
                    LogLevel.VERBOSE,
                    tokenProvider,
                    listener,
                    null // offlineListener - not needed for Tap to Pay
                )
                Log.d(TAG, "Terminal SDK initialized")
            } else {
                Log.d(TAG, "Terminal SDK already initialized")
            }
            Result.success(Unit)
        } catch (e: TerminalException) {
            Log.e(TAG, "Failed to initialize Terminal SDK: ${e.errorMessage}", e)
            Result.failure(e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Terminal SDK: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Discover Tap to Pay readers
     */
    suspend fun discoverReaders(isSimulated: Boolean): Result<List<Reader>> = 
        suspendCancellableCoroutine { continuation ->
            val config = DiscoveryConfiguration.TapToPayDiscoveryConfiguration(
                isSimulated = isSimulated
            )

            val callback = object : Callback {
                override fun onSuccess() {
                    Log.d(TAG, "Discovery completed")
                }

                override fun onFailure(e: TerminalException) {
                    Log.e(TAG, "Discovery failed: ${e.errorMessage}")
                    if (continuation.isActive) {
                        continuation.resume(Result.failure(e))
                    }
                }
            }

            val discoveryListener = object : DiscoveryListener {
                private val readers = mutableListOf<Reader>()

                override fun onUpdateDiscoveredReaders(discoveredReaders: List<Reader>) {
                    Log.d(TAG, "Discovered ${discoveredReaders.size} readers")
                    readers.clear()
                    readers.addAll(discoveredReaders)
                    
                    if (readers.isNotEmpty() && continuation.isActive) {
                        continuation.resume(Result.success(readers.toList()))
                    }
                }
            }

            try {
                val cancelable = Terminal.getInstance().discoverReaders(config, discoveryListener, callback)
                
                // Store cancelable for cleanup
                continuation.invokeOnCancellation {
                    try {
                        cancelable.cancel(object : Callback {
                            override fun onSuccess() {
                                Log.d(TAG, "Discovery cancelled")
                            }
                            override fun onFailure(e: TerminalException) {
                                Log.e(TAG, "Failed to cancel discovery", e)
                            }
                        })
                    } catch (e: Exception) {
                        Log.e(TAG, "Error cancelling discovery", e)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start discovery", e)
                if (continuation.isActive) {
                    continuation.resume(Result.failure(e))
                }
            }
        }

    /**
     * Connect to a reader
     * For Tap to Pay, locationId is required
     */
    suspend fun connectReader(reader: Reader, locationId: String): Result<Reader> = 
        suspendCancellableCoroutine { continuation ->
            val config = ConnectionConfiguration.TapToPayConnectionConfiguration(
                locationId = locationId,
                autoReconnectOnUnexpectedDisconnect = true,
                tapToPayReaderListener = null
            )

            val callback = object : ReaderCallback {
                override fun onSuccess(connectedReader: Reader) {
                    Log.d(TAG, "Connected to reader: ${connectedReader.serialNumber}")
                    currentReader = connectedReader
                    continuation.resume(Result.success(connectedReader))
                }

                override fun onFailure(e: TerminalException) {
                    Log.e(TAG, "Failed to connect: ${e.errorMessage}")
                    continuation.resume(Result.failure(e))
                }
            }

            try {
                Terminal.getInstance().connectReader(reader, config, callback)
            } catch (e: Exception) {
                Log.e(TAG, "Error connecting to reader", e)
                continuation.resume(Result.failure(e))
            }
        }

    /**
     * Collect payment method using Tap to Pay
     * Uses processPaymentIntent (newer SDK 5.x approach)
     */
    suspend fun collectPaymentMethod(
        clientSecret: String
    ): Result<PaymentIntent> = suspendCancellableCoroutine { continuation ->
        
        val retrieveCallback = object : PaymentIntentCallback {
            override fun onSuccess(paymentIntent: PaymentIntent) {
                Log.d(TAG, "PaymentIntent retrieved, processing payment")
                
                // Use processPaymentIntent (SDK 5.x recommended approach)
                val processCallback = object : PaymentIntentCallback {
                    override fun onSuccess(processedIntent: PaymentIntent) {
                        Log.d(TAG, "Payment processed successfully")
                        continuation.resume(Result.success(processedIntent))
                    }

                    override fun onFailure(e: TerminalException) {
                        Log.e(TAG, "Failed to process payment: ${e.errorMessage}")
                        continuation.resume(Result.failure(e))
                    }
                }

                val collectConfig = CollectPaymentIntentConfiguration.Builder()
                    .skipTipping(true)
                    .build()
                    
                val confirmConfig = ConfirmPaymentIntentConfiguration.Builder()
                    .build()

                try {
                    val cancelable = Terminal.getInstance().processPaymentIntent(
                        paymentIntent,
                        collectConfig,
                        confirmConfig,
                        processCallback
                    )
                    
                    // Store cancelable for cleanup
                    continuation.invokeOnCancellation {
                        try {
                            cancelable.cancel(object : Callback {
                                override fun onSuccess() {
                                    Log.d(TAG, "Payment processing cancelled")
                                }
                                override fun onFailure(e: TerminalException) {
                                    Log.e(TAG, "Failed to cancel payment processing", e)
                                }
                            })
                        } catch (e: Exception) {
                            Log.e(TAG, "Error cancelling payment processing", e)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error processing payment", e)
                    continuation.resume(Result.failure(e))
                }
            }

            override fun onFailure(e: TerminalException) {
                Log.e(TAG, "Failed to retrieve PaymentIntent: ${e.errorMessage}")
                continuation.resume(Result.failure(e))
            }
        }

        try {
            Terminal.getInstance().retrievePaymentIntent(clientSecret, retrieveCallback)
        } catch (e: Exception) {
            Log.e(TAG, "Error retrieving PaymentIntent", e)
            continuation.resume(Result.failure(e))
        }
    }

    /**
     * Process payment (kept for compatibility, but collectPaymentMethod now handles it)
     */
    suspend fun processPayment(paymentIntent: PaymentIntent): Result<PaymentIntent> {
        // In SDK 5.x, processPaymentIntent handles both collection and confirmation
        // This is already done in collectPaymentMethod above
        return Result.success(paymentIntent)
    }

    /**
     * Get currently connected reader
     */
    fun getConnectedReader(): Reader? = currentReader

    /**
     * Check if reader is connected
     */
    fun isReaderConnected(): Boolean = currentReader != null

    /**
     * Disconnect current reader
     */
    suspend fun disconnectReader(): Result<Unit> = suspendCancellableCoroutine { continuation ->
        val callback = object : Callback {
            override fun onSuccess() {
                Log.d(TAG, "Reader disconnected")
                currentReader = null
                continuation.resume(Result.success(Unit))
            }

            override fun onFailure(e: TerminalException) {
                Log.e(TAG, "Failed to disconnect: ${e.errorMessage}")
                continuation.resume(Result.failure(e))
            }
        }

        try {
            Terminal.getInstance().disconnectReader(callback)
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting reader", e)
            continuation.resume(Result.failure(e))
        }
    }
}
