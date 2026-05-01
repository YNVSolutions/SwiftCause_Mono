package com.example.swiftcause.data.repository

import com.example.swiftcause.domain.models.Campaign
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

data class OrganizationBranding(
    val displayName: String?,
    val logoUrl: String?,
    val thankYouMessage: String?,
    val accentColorHex: String?,
    val idleImageUrl: String?
)

class CampaignRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {

    /**
     * Fetches campaigns for a kiosk based on assigned campaigns or organization.
     * Filters to only show active campaigns that are either:
     * - Assigned to this specific kiosk
     * - Marked as global (isGlobal = true)
     *
     * @param organizationCurrency Currency fetched from organization (pass from kiosk session to avoid re-fetching)
     */
    suspend fun getCampaignsForKiosk(
        assignedCampaignIds: List<String>,
        organizationId: String?,
        showAllCampaigns: Boolean = false,
        organizationCurrency: String? = null
    ): Result<List<Campaign>> {
        return try {
            val campaigns = mutableListOf<Campaign>()

            if (showAllCampaigns && organizationId != null) {
                // Fetch all active campaigns for the organization
                val snapshot = firestore.collection("campaigns")
                    .whereEqualTo("organizationId", organizationId)
                    .whereEqualTo("status", "active")
                    .get()
                    .await()

                campaigns.addAll(snapshot.documents.mapNotNull { doc ->
                    mapDocumentToCampaign(doc.id, doc.data)
                })
            } else if (assignedCampaignIds.isNotEmpty()) {
                // Fetch specific assigned campaigns
                // Firestore whereIn has a limit of 10, so we batch if needed
                assignedCampaignIds.chunked(10).forEach { chunk ->
                    val snapshot = firestore.collection("campaigns")
                        .whereIn("__name__", chunk.map { firestore.collection("campaigns").document(it) })
                        .get()
                        .await()

                    campaigns.addAll(snapshot.documents.mapNotNull { doc ->
                        val campaign = mapDocumentToCampaign(doc.id, doc.data)
                        // Only include active campaigns
                        if (campaign?.let { getStatus(doc.data) } == "active") campaign else null
                    })
                }
            }

            // Also fetch global campaigns for the organization
            if (organizationId != null) {
                val globalSnapshot = firestore.collection("campaigns")
                    .whereEqualTo("organizationId", organizationId)
                    .whereEqualTo("isGlobal", true)
                    .whereEqualTo("status", "active")
                    .get()
                    .await()

                globalSnapshot.documents.forEach { doc ->
                    val campaign = mapDocumentToCampaign(doc.id, doc.data)
                    if (campaign != null && campaigns.none { it.id == campaign.id }) {
                        campaigns.add(campaign)
                    }
                }
            }

            // Enrich campaigns with organization currency (use cached value if provided)
            val orgCurrency = organizationCurrency ?: organizationId?.let { getOrganizationCurrency(it) }
            val enrichedCampaigns = campaigns.map { campaign ->
                if (orgCurrency != null) {
                    campaign.copy(currency = orgCurrency)
                } else {
                    campaign
                }
            }

            Result.success(enrichedCampaigns.sortedByDescending { it.raised })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Fetches a single campaign by ID
     */
    suspend fun getCampaignById(campaignId: String): Result<Campaign?> {
        return try {
            val doc = firestore.collection("campaigns")
                .document(campaignId)
                .get()
                .await()

            if (doc.exists()) {
                val campaign = mapDocumentToCampaign(doc.id, doc.data)

                // Enrich with organization currency
                val enrichedCampaign = campaign?.let {
                    if (it.organizationId.isNotEmpty()) {
                        val orgCurrency = getOrganizationCurrency(it.organizationId)
                        if (orgCurrency != null) {
                            it.copy(currency = orgCurrency)
                        } else {
                            it
                        }
                    } else {
                        it
                    }
                }

                Result.success(enrichedCampaign)
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun getStatus(data: Map<String, Any>?): String {
        return data?.get("status") as? String ?: "active"
    }

    /**
     * Fetches the currency from organization document
     * Public method to allow caching by ViewModel
     */
    suspend fun getOrganizationCurrency(organizationId: String): String? {
        return try {
            val orgDoc = firestore.collection("organizations")
                .document(organizationId)
                .get()
                .await()

            val currency = orgDoc.data?.get("currency") as? String
            currency?.lowercase() // Convert to lowercase for Stripe
        } catch (e: Exception) {
            android.util.Log.e("CampaignRepository", "Failed to fetch organization currency", e)
            null
        }
    }

    /**
     * Fetches organization branding fields from settings map (preferred) with top-level fallbacks.
     */
    suspend fun getOrganizationBranding(organizationId: String): OrganizationBranding? {
        return try {
            val orgDoc = firestore.collection("organizations")
                .document(organizationId)
                .get()
                .await()

            if (!orgDoc.exists()) return null

            val data = orgDoc.data
            val settings = data?.get("settings") as? Map<*, *>

            val displayName = (settings?.get("displayName") as? String)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: (data?.get("displayName") as? String)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }
                ?: (data?.get("name") as? String)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

            val logoUrl = (settings?.get("logoUrl") as? String)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: (data?.get("logoUrl") as? String)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

            val thankYouMessage = (settings?.get("thankYouMessage") as? String)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: (data?.get("thankYouMessage") as? String)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

            val accentColorHex = (settings?.get("accentColorHex") as? String)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: (data?.get("accentColorHex") as? String)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

            val idleImageUrl = (settings?.get("idleImageUrl") as? String)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?: (data?.get("idleImageUrl") as? String)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }

            OrganizationBranding(
                displayName = displayName,
                logoUrl = logoUrl,
                thankYouMessage = thankYouMessage,
                accentColorHex = accentColorHex,
                idleImageUrl = idleImageUrl
            )
        } catch (e: Exception) {
            android.util.Log.e("CampaignRepository", "Failed to fetch organization branding", e)
            null
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapDocumentToCampaign(id: String, data: Map<String, Any>?): Campaign? {
        if (data == null) return null

        val configuration = data["configuration"] as? Map<String, Any>
        val organizationInfo = data["organizationInfo"] as? Map<String, Any>

        // Handle predefinedAmounts - can be List<Long> or List<Double>
        val predefinedAmounts = (configuration?.get("predefinedAmounts") as? List<*>)
            ?.mapNotNull {
                when (it) {
                    is Long -> it
                    is Double -> it.toLong()
                    is Int -> it.toLong()
                    else -> null
                }
            } ?: listOf(10L, 25L, 50L, 100L)

        // Handle raised amount - stored in cents in Firestore
        val raised = when (val r = data["raised"]) {
            is Long -> r
            is Double -> r.toLong()
            is Int -> r.toLong()
            else -> 0L
        }

        // Handle goal amount - stored in major units (dollars)
        val goal = when (val g = data["goal"]) {
            is Long -> g
            is Double -> g.toLong()
            is Int -> g.toLong()
            else -> 0L
        }

        val galleryImages = (data["galleryImages"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()

        return Campaign(
            id = id,
            title = data["title"] as? String ?: "",
            shortDescription = data["description"] as? String ?: "",
            longDescription = data["longDescription"] as? String ?: "",
            coverImageUrl = data["coverImageUrl"] as? String,
            imageUrls = galleryImages,
            videoUrl = data["videoUrl"] as? String,
            raised = raised,
            goal = goal,
            predefinedAmounts = predefinedAmounts,
            currency = organizationInfo?.get("currency") as? String ?: data["currency"] as? String ?: "USD",
            enableRecurring = configuration?.get("enableRecurring") as? Boolean ?: false,
            isGiftAid = configuration?.get("isGiftAid") as? Boolean
                ?: configuration?.get("enableGiftAid") as? Boolean
                ?: configuration?.get("giftAidEnabled") as? Boolean
                ?: false,
            organizationName = organizationInfo?.get("name") as? String ?: "",
            organizationId = data["organizationId"] as? String ?: ""
        )
    }
}
