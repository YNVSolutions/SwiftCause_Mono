package com.example.swiftcause

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.swiftcause.domain.models.KioskSession
import com.example.swiftcause.presentation.screens.CampaignDetailsScreen
import com.example.swiftcause.presentation.screens.CampaignListScreen
import com.example.swiftcause.presentation.screens.KioskLoginScreen
import com.example.swiftcause.presentation.viewmodels.CampaignListViewModel
import com.example.swiftcause.ui.theme.SwiftCauseTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SwiftCauseTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    var kioskSession by remember { mutableStateOf<KioskSession?>(null) }
                    
                    when {
                        kioskSession == null -> {
                            KioskLoginScreen(
                                onLoginSuccess = { session ->
                                    kioskSession = session
                                }
                            )
                        }
                        else -> {
                            KioskMainContent(
                                kioskSession = kioskSession!!,
                                modifier = Modifier.padding(innerPadding)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun KioskMainContent(
    kioskSession: KioskSession,
    modifier: Modifier = Modifier,
    viewModel: CampaignListViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(kioskSession) {
        viewModel.loadCampaigns(kioskSession)
    }
    
    when {
        uiState.selectedCampaign != null -> {
            CampaignDetailsScreen(
                campaign = uiState.selectedCampaign!!,
                onBackClick = { viewModel.clearSelectedCampaign() },
                onDonateClick = { amount, isRecurring, interval ->
                    // TODO: Handle donation - integrate with Stripe
                }
            )
        }
        uiState.isLoading -> {
            Box(
                modifier = modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
        uiState.error != null -> {
            Box(
                modifier = modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(text = uiState.error ?: "Error loading campaigns")
            }
        }
        else -> {
            CampaignListScreen(
                campaigns = uiState.campaigns,
                isLoading = false,
                onCampaignClick = { campaign ->
                    viewModel.selectCampaign(campaign)
                },
                onAmountClick = { campaign, _ ->
                    viewModel.selectCampaign(campaign)
                },
                onDonateClick = { campaign ->
                    viewModel.selectCampaign(campaign)
                },
                modifier = modifier
            )
        }
    }
}
