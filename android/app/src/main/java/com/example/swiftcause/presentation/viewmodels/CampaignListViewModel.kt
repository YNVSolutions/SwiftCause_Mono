package com.example.swiftcause.presentation.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.swiftcause.R
import com.example.swiftcause.data.repository.CampaignRepository
import com.example.swiftcause.domain.models.Campaign
import com.example.swiftcause.domain.models.KioskSession
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CampaignListUiState(
    val campaigns: List<Campaign> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val selectedCampaign: Campaign? = null,
    val organizationDisplayName: String? = null,
    val organizationLogoUrl: String? = null,
    val organizationThankYouMessage: String? = null,
    val organizationAccentColorHex: String? = null,
    val organizationIdleImageUrl: String? = null
)

class CampaignListViewModel(
    application: Application,
    private val repository: CampaignRepository = CampaignRepository()
) : AndroidViewModel(application) {

    constructor(application: Application) : this(application, CampaignRepository())

    private val _uiState = MutableStateFlow(CampaignListUiState())
    val uiState: StateFlow<CampaignListUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null

    fun loadCampaigns(kioskSession: KioskSession) {
        viewModelScope.launch {
            loadCampaignsSequential(kioskSession)
        }
    }

    private suspend fun loadCampaignsSequential(kioskSession: KioskSession) {
        try {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            // Fetch organization currency once at the start
            val orgCurrency = kioskSession.organizationId?.let {
                repository.getOrganizationCurrency(it)
            }
            val organizationBranding = kioskSession.organizationId?.let {
                repository.getOrganizationBranding(it)
            }

            val result = repository.getCampaignsForKiosk(
                assignedCampaignIds = kioskSession.assignedCampaigns,
                organizationId = kioskSession.organizationId,
                showAllCampaigns = kioskSession.settings.showAllCampaigns,
                organizationCurrency = orgCurrency  // Pass cached currency
            )

            result.fold(
                onSuccess = { campaigns ->
                    val displayCampaigns = if (kioskSession.settings.maxCampaignsDisplay > 0) {
                        campaigns.take(kioskSession.settings.maxCampaignsDisplay)
                    } else {
                        campaigns
                    }
                    _uiState.value = _uiState.value.copy(
                        campaigns = displayCampaigns,
                        isLoading = false,
                        organizationDisplayName = organizationBranding?.displayName,
                        organizationLogoUrl = organizationBranding?.logoUrl,
                        organizationThankYouMessage = organizationBranding?.thankYouMessage,
                        organizationAccentColorHex = organizationBranding?.accentColorHex,
                        organizationIdleImageUrl = organizationBranding?.idleImageUrl
                    )
                },
                onFailure = { exception ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = exception.message
                            ?: getApplication<Application>().getString(R.string.campaign_list_error),
                        organizationDisplayName = organizationBranding?.displayName,
                        organizationLogoUrl = organizationBranding?.logoUrl,
                        organizationThankYouMessage = organizationBranding?.thankYouMessage,
                        organizationAccentColorHex = organizationBranding?.accentColorHex,
                        organizationIdleImageUrl = organizationBranding?.idleImageUrl
                    )
                }
            )
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (exception: Exception) {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                error = exception.message
                    ?: getApplication<Application>().getString(R.string.campaign_list_error)
            )
        }
    }

    fun selectCampaign(campaign: Campaign) {
        _uiState.value = _uiState.value.copy(selectedCampaign = campaign)
    }

    fun clearSelectedCampaign() {
        _uiState.value = _uiState.value.copy(selectedCampaign = null)
    }

    fun startPolling(kioskSession: KioskSession, interval: Long = 60000L) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                loadCampaignsSequential(kioskSession)
                delay(interval)
            }
        }
    }

    fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    fun refreshCampaign(campaignId: String) {
        viewModelScope.launch {
            val result = repository.getCampaignById(campaignId)
            result.fold(
                onSuccess = { campaign ->
                    if (campaign != null) {
                        val updatedCampaigns = _uiState.value.campaigns.map {
                            if (it.id == campaignId) campaign else it
                        }
                        _uiState.value = _uiState.value.copy(
                            campaigns = updatedCampaigns,
                            selectedCampaign = if (_uiState.value.selectedCampaign?.id == campaignId) campaign else _uiState.value.selectedCampaign
                        )
                    }
                },
                onFailure = { /* Silently fail refresh */ }
            )
        }
    }

    fun retry(kioskSession: KioskSession) {
        loadCampaigns(kioskSession)
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }
}
