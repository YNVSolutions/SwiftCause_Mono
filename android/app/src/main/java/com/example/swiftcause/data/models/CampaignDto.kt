package com.example.swiftcause.data.models

import com.google.gson.annotations.SerializedName

data class CampaignDto(
    @SerializedName("id")
    val id: String = "",
    @SerializedName("title")
    val title: String = "",
    @SerializedName("description")
    val description: String = "",
    @SerializedName("longDescription")
    val longDescription: String? = null,
    @SerializedName("goal")
    val goal: Long = 0,
    @SerializedName("raised")
    val raised: Long = 0,
    @SerializedName("coverImageUrl")
    val coverImageUrl: String? = null,
    @SerializedName("galleryImages")
    val galleryImages: List<String>? = null,
    @SerializedName("videoUrl")
    val videoUrl: String? = null,
    @SerializedName("category")
    val category: String = "",
    @SerializedName("status")
    val status: String = "active",
    @SerializedName("organizationId")
    val organizationId: String? = null,
    @SerializedName("donationCount")
    val donationCount: Int = 0,
    @SerializedName("configuration")
    val configuration: CampaignConfigurationDto? = null,
    @SerializedName("assignedKiosks")
    val assignedKiosks: List<String>? = null,
    @SerializedName("isGlobal")
    val isGlobal: Boolean = false,
    @SerializedName("organizationInfo")
    val organizationInfo: OrganizationInfoDto? = null
)

data class CampaignConfigurationDto(
    @SerializedName("predefinedAmounts")
    val predefinedAmounts: List<Long>? = null,
    @SerializedName("allowCustomAmount")
    val allowCustomAmount: Boolean = true,
    @SerializedName("minCustomAmount")
    val minCustomAmount: Long = 1,
    @SerializedName("maxCustomAmount")
    val maxCustomAmount: Long = 10000,
    @SerializedName("enableRecurring")
    val enableRecurring: Boolean = false,
    @SerializedName("recurringIntervals")
    val recurringIntervals: List<String>? = null,
    @SerializedName("showProgressBar")
    val showProgressBar: Boolean = true,
    @SerializedName("showDonorCount")
    val showDonorCount: Boolean = true,
    @SerializedName("primaryCTAText")
    val primaryCTAText: String = "Donate",
    @SerializedName("accentColor")
    val accentColor: String? = null,
    @SerializedName("isGiftAid")
    val isGiftAid: Boolean = false,
    @SerializedName("enableGiftAid")
    val enableGiftAid: Boolean = false
)

data class OrganizationInfoDto(
    @SerializedName("name")
    val name: String = "",
    @SerializedName("description")
    val description: String? = null,
    @SerializedName("website")
    val website: String? = null,
    @SerializedName("logo")
    val logo: String? = null
)
