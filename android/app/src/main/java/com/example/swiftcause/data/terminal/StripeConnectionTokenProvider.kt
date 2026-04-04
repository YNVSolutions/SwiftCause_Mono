package com.example.swiftcause.data.terminal

import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider
import com.stripe.stripeterminal.external.models.ConnectionTokenException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

class StripeConnectionTokenProvider : ConnectionTokenProvider {
    private val client = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO)
    
    companion object {
        private const val CONNECTION_TOKEN_URL = 
            "https://us-central1-swiftcause-app.cloudfunctions.net/createConnectionToken"
    }

    override fun fetchConnectionToken(callback: ConnectionTokenCallback) {
        scope.launch {
            try {
                val request = Request.Builder()
                    .url(CONNECTION_TOKEN_URL)
                    .post(okhttp3.RequestBody.create(null, ByteArray(0)))
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val responseBody = response.body?.string()
                        val jsonObject = JSONObject(responseBody ?: "{}")
                        val secret = jsonObject.optString("secret")
                        
                        if (secret.isNotEmpty()) {
                            callback.onSuccess(secret)
                        } else {
                            callback.onFailure(
                                ConnectionTokenException("Empty secret in response")
                            )
                        }
                    } else {
                        callback.onFailure(
                            ConnectionTokenException("HTTP ${response.code}: ${response.message}")
                        )
                    }
                }
            } catch (e: Exception) {
                callback.onFailure(
                    ConnectionTokenException("Failed to fetch connection token: ${e.message}")
                )
            }
        }
    }
}
