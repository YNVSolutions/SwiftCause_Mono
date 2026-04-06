package com.example.swiftcause.domain.models

data class Campaign(
    val id: String,
    val title: String,
    val shortDescription: String = "",
    val longDescription: String = "",
    val coverImageUrl: String?,
    val imageUrls: List<String> = emptyList(),
    val videoUrl: String? = null,
    val raised: Long = 0, // in minor units (cents)
    val goal: Long, // in major units (dollars)
    val predefinedAmounts: List<Long> = emptyList(), // in major units
    val currency: String = "USD",
    val enableRecurring: Boolean = false,
    val organizationName: String = ""
) {
    fun getProgressPercentage(): Float {
        if (goal == 0L) return 0f
        // raised is in minor units, goal is in major units
        val raisedInMajor = raised / 100.0
        return ((raisedInMajor / goal) * 100).coerceAtMost(100.0).toFloat()
    }
    
    fun getTop3Amounts(): List<Long> {
        return predefinedAmounts.take(3).ifEmpty {
            listOf(10, 25, 50) // Default amounts
        }
    }
    
    fun getAllImages(): List<String> {
        val images = mutableListOf<String>()
        coverImageUrl?.let { images.add(it) }
        images.addAll(imageUrls.filter { it != coverImageUrl })
        return images.ifEmpty { listOf("") }
    }
}
