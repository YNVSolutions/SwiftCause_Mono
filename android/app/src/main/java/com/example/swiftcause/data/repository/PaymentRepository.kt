package com.example.swiftcause.data.repository

import android.util.Log
import com.example.swiftcause.data.models.CreatePaymentIntentRequest
import com.example.swiftcause.data.models.CreatePaymentIntentResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

/**
 * Repository for handling payment operations via raw HTTP
 * Matches the web implementation which uses fetch() instead of Firebase SDK
 */
class PaymentRepository(
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    companion object {
        private const val TAG = "PaymentRepository"
        private const val FUNCTION_URL = "https://us-central1-swiftcause-app.cloudfunctions.net/createKioskPaymentIntent"
    }

    /**
     * Creates a payment intent for one-time or recurring donations
     * Uses raw HTTP POST (exactly like web) instead of Firebase SDK
     *
     * @param request Payment intent request with amount, currency, and metadata
     * @return CreatePaymentIntentResponse with clientSecret
     */
    suspend fun createPaymentIntent(
        request: CreatePaymentIntentRequest
    ): Result<CreatePaymentIntentResponse> = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "=== Creating Payment Intent ===")
            Log.d(TAG, "Amount: ${request.amount} (${request.amount / 100.0} ${request.currency.uppercase()})")
            Log.d(TAG, "Currency: ${request.currency}")
            Log.d(TAG, "Campaign ID: ${request.metadata.campaignId}")
            Log.d(TAG, "Campaign Title: ${request.metadata.campaignTitle}")
            Log.d(TAG, "Organization ID: ${request.metadata.organizationId}")
            Log.d(TAG, "Platform: ${request.metadata.platform}")
            Log.d(TAG, "Frequency: ${request.frequency ?: "one-time"}")
            Log.d(TAG, "Is Anonymous: ${request.metadata.isAnonymous}")
            Log.d(TAG, "Is Gift Aid (metadata): ${request.metadata.isGiftAid}")
            Log.d(TAG, "Recurring Interest (metadata): ${request.metadata.recurringInterest}")

            // Build request JSON
            val requestJson = JSONObject().apply {
                put("amount", request.amount)
                put("currency", request.currency)
                put("frequency", request.frequency ?: JSONObject.NULL)
                put("intervalCount", request.intervalCount ?: JSONObject.NULL)
                put("paymentMethodId", request.paymentMethodId ?: JSONObject.NULL)
                put("setupIntentId", request.setupIntentId ?: JSONObject.NULL)
                put("customerId", request.customerId ?: JSONObject.NULL)
                put("metadata", JSONObject().apply {
                    put("campaignId", request.metadata.campaignId)
                    put("campaignTitle", request.metadata.campaignTitle)
                    put("organizationId", request.metadata.organizationId)
                    put("platform", request.metadata.platform)
                    put("kioskId", request.metadata.kioskId ?: JSONObject.NULL)
                    put("donorName", request.metadata.donorName ?: JSONObject.NULL)
                    put("donorEmail", request.metadata.donorEmail ?: JSONObject.NULL)
                    put("isAnonymous", request.metadata.isAnonymous)
                    put("isGiftAid", request.metadata.isGiftAid)
                    put("recurringInterest", request.metadata.recurringInterest)
                })
                put(
                    "donor",
                    request.donor?.let {
                        JSONObject().apply {
                            put("email", it.email)
                            put("name", it.name)
                            put("phone", it.phone ?: JSONObject.NULL)
                        }
                    } ?: JSONObject.NULL
                )
            }

            Log.d(TAG, "Calling Cloud Function: $FUNCTION_URL")
            Log.d(TAG, "Request payload: $requestJson")

            // Build HTTP request (exactly like web fetch)
            val requestBody = requestJson.toString()
                .toRequestBody("application/json; charset=utf-8".toMediaType())

            val httpRequest = Request.Builder()
                .url(FUNCTION_URL)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .build()

            // Execute request
            val response = httpClient.newCall(httpRequest).execute()

            val responseBody = response.body?.string() ?: ""
            Log.d(TAG, "Response code: ${response.code}")
            Log.d(TAG, "Response body: $responseBody")

            if (!response.isSuccessful) {
                Log.e(TAG, "=== Payment Intent Creation Failed ===")
                Log.e(TAG, "HTTP Status: ${response.code}")
                Log.e(TAG, "Response: $responseBody")
                throw IOException("HTTP ${response.code}: $responseBody")
            }

            // Parse response
            val responseJson = JSONObject(responseBody)
            val readNullableString = { key: String ->
                if (!responseJson.has(key) || responseJson.isNull(key)) null else responseJson.optString(key).ifEmpty { null }
            }
            val clientSecret = readNullableString("clientSecret")
            val setupIntentClientSecret = readNullableString("setupIntentClientSecret")
            val customerId = readNullableString("customerId")
            val success = responseJson.optBoolean("success", false)
            val message = readNullableString("message")
            val subscriptionId = readNullableString("subscriptionId")
            val invoiceId = readNullableString("invoiceId")
            val amountPaid = if (responseJson.has("amountPaid") && !responseJson.isNull("amountPaid")) {
                responseJson.optLong("amountPaid")
            } else {
                null
            }

            if (clientSecret == null && setupIntentClientSecret == null && !success) {
                throw Exception(message ?: "Missing payment confirmation data in response")
            }

            Log.d(TAG, "✓ Payment Intent Created Successfully")
            Log.d(TAG, "Client Secret: ${clientSecret?.take(20)}...")

            Result.success(
                CreatePaymentIntentResponse(
                    clientSecret = clientSecret,
                    setupIntentClientSecret = setupIntentClientSecret,
                    customerId = customerId,
                    success = success,
                    message = message ?: if (clientSecret != null) "Payment intent created" else null,
                    subscriptionId = subscriptionId,
                    invoiceId = invoiceId,
                    amountPaid = amountPaid
                )
            )

        } catch (e: Exception) {
            Log.e(TAG, "=== Payment Intent Creation Failed ===")
            Log.e(TAG, "Error type: ${e.javaClass.simpleName}")
            Log.e(TAG, "Error message: ${e.message}")
            Log.e(TAG, "Stack trace:", e)
            Result.failure(e)
        }
    }
}
