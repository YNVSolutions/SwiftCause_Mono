package com.example.swiftcause.utils

/**
 * Utility object for currency formatting operations.
 * Handles conversion between minor units (cents) and major units (dollars)
 * and formats currency values for display.
 */
object CurrencyFormatter {
    
    /**
     * Formats an amount in minor units (e.g., cents) to currency string.
     * 
     * @param amount Amount in minor units (e.g., 45000 = $450.00)
     * @param currency Currency code (USD, EUR, GBP)
     * @return Formatted currency string without decimals (e.g., "$450")
     */
    fun formatCurrency(amount: Long, currency: String): String {
        val amountInMajor = amount / 100.0
        return when (currency.uppercase()) {
            "USD" -> "$${amountInMajor.toInt()}"
            "EUR" -> "€${amountInMajor.toInt()}"
            "GBP" -> "£${amountInMajor.toInt()}"
            else -> "$currency ${amountInMajor.toInt()}"
        }
    }
    
    /**
     * Formats an amount in major units (e.g., dollars) to currency string.
     * 
     * @param amount Amount in major units (e.g., 1000 = $1,000)
     * @param currency Currency code (USD, EUR, GBP)
     * @return Formatted currency string (e.g., "$1,000")
     */
    fun formatCurrencyFromMajor(amount: Long, currency: String): String {
        val formattedAmount = if (amount >= 1000) {
            String.format("%,d", amount)
        } else {
            amount.toString()
        }
        
        return when (currency.uppercase()) {
            "USD" -> "$$formattedAmount"
            "EUR" -> "€$formattedAmount"
            "GBP" -> "£$formattedAmount"
            else -> "$currency $formattedAmount"
        }
    }
    
    /**
     * Returns the currency symbol for a given currency code.
     * 
     * @param currency Currency code (USD, EUR, GBP)
     * @return Currency symbol (e.g., "$", "€", "£")
     */
    fun getCurrencySymbol(currency: String): String {
        return when (currency.uppercase()) {
            "USD" -> "$"
            "EUR" -> "€"
            "GBP" -> "£"
            else -> currency
        }
    }
}
