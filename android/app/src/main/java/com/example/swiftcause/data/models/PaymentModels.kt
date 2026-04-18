package com.example.swiftcause.data.models

import com.google.gson.annotations.SerializedName

/**
 * Request to create a payment intent
 */
data class CreatePaymentIntentRequest(
    @SerializedName("amount")
    val amount: Long,  // Amount in cents (e.g., 5000 = $50.00)
    
    @SerializedName("currency")
    val currency: String,  // Lowercase currency code (e.g., "usd", "gbp")
    
    @SerializedName("metadata")
    val metadata: PaymentMetadata,
    
    @SerializedName("frequency")
    val frequency: String? = null,  // Optional: "once", "month", "year" for recurring
    
    @SerializedName("donor")
    val donor: DonorInfo? = null,  // Optional donor information
    
    @SerializedName("paymentMethodId")
    val paymentMethodId: String? = null  // Optional: for recurring payments
)

/**
 * Payment metadata sent to backend
 */
data class PaymentMetadata(
    @SerializedName("campaignId")
    val campaignId: String,
    
    @SerializedName("campaignTitle")
    val campaignTitle: String,
    
    @SerializedName("organizationId")
    val organizationId: String,
    
    @SerializedName("platform")
    val platform: String = "android_kiosk",
    
    @SerializedName("kioskId")
    val kioskId: String? = null,
    
    @SerializedName("donorName")
    val donorName: String? = null,
    
    @SerializedName("donorEmail")
    val donorEmail: String? = null,
    
    @SerializedName("isAnonymous")
    val isAnonymous: Boolean = false,
    
    @SerializedName("isGiftAid")
    val isGiftAid: Boolean = false,
    
    @SerializedName("recurringInterest")
    val recurringInterest: Boolean = false
)

/**
 * Donor information for recurring payments
 */
data class DonorInfo(
    @SerializedName("email")
    val email: String,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("phone")
    val phone: String? = null
)

/**
 * Response from createKioskPaymentIntent
 */
data class CreatePaymentIntentResponse(
    @SerializedName("clientSecret")
    val clientSecret: String?,
    
    // For recurring payments that succeed immediately
    @SerializedName("success")
    val success: Boolean? = null,
    
    @SerializedName("message")
    val message: String? = null,
    
    @SerializedName("subscriptionId")
    val subscriptionId: String? = null,
    
    @SerializedName("invoiceId")
    val invoiceId: String? = null,
    
    @SerializedName("amountPaid")
    val amountPaid: Long? = null
)

/**
 * Payment result after confirmation
 */
sealed class PaymentResult {
    data class Success(
        val transactionId: String,
        val amount: Long,
        val currency: String
    ) : PaymentResult()
    
    data class Error(
        val message: String,
        val code: String? = null
    ) : PaymentResult()
    
    object Cancelled : PaymentResult()
}
