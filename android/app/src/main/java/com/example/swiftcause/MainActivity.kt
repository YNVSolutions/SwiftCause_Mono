package com.example.swiftcause

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.swiftcause.domain.models.Campaign
import com.example.swiftcause.domain.models.KioskSession
import com.example.swiftcause.presentation.screens.CampaignDetailsScreen
import com.example.swiftcause.presentation.screens.CampaignListScreen
import com.example.swiftcause.presentation.screens.KioskLoginScreen
import com.example.swiftcause.presentation.viewmodels.CampaignListViewModel
import com.example.swiftcause.presentation.viewmodels.PaymentState
import com.example.swiftcause.presentation.viewmodels.PaymentViewModel
import com.example.swiftcause.presentation.viewmodels.TapToPayState
import com.example.swiftcause.presentation.viewmodels.TapToPayViewModel
import com.example.swiftcause.ui.theme.SwiftCauseTheme
import com.example.swiftcause.utils.StripeConfig
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import com.stripe.android.paymentsheet.rememberPaymentSheet
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton

data class PendingDonation(
    val campaign: Campaign,
    val amount: Long,
    val isRecurring: Boolean,
    val interval: String?
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Initialize Stripe with key from local.properties (from root .env)
        StripeConfig.initialize(this)
        
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
    viewModel: CampaignListViewModel = viewModel(),
    paymentViewModel: PaymentViewModel = viewModel(),
    tapToPayViewModel: TapToPayViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val paymentState by paymentViewModel.paymentState.collectAsState()
    val clientSecret by paymentViewModel.clientSecret.collectAsState()
    val tapToPayState by tapToPayViewModel.state.collectAsState()
    val context = LocalContext.current
    
    // Track selected payment method (null = show selection, "card" or "tap")
    var selectedPaymentMethod by remember { mutableStateOf<String?>(null) }
    var pendingDonation by remember { mutableStateOf<PendingDonation?>(null) }
    
    // Track location permission state
    var hasLocationPermission by remember { 
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    
    // Permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasLocationPermission = isGranted
        if (isGranted) {
            // Initialize Tap to Pay after permission granted
            val isDebuggable = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            tapToPayViewModel.initializeTapToPay(isSimulated = isDebuggable)
        } else {
            Toast.makeText(
                context,
                "Location permission is required for Tap to Pay",
                Toast.LENGTH_LONG
            ).show()
        }
    }
    
    // Initialize Tap to Pay on app start (request permission first)
    LaunchedEffect(Unit) {
        if (hasLocationPermission) {
            val isDebuggable = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            tapToPayViewModel.initializeTapToPay(isSimulated = isDebuggable)
        } else {
            // Request location permission
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }
    
    // Initialize PaymentSheet
    val paymentSheet = rememberPaymentSheet { result ->
        paymentViewModel.handlePaymentResult(result)
    }
    
    // Handle payment state changes
    LaunchedEffect(paymentState) {
        when (paymentState) {
            is PaymentState.Ready -> {
                // Payment intent ready - check which payment method to use
                clientSecret?.let { secret ->
                    when (selectedPaymentMethod) {
                        "card" -> {
                            // Show PaymentSheet for card entry
                            paymentSheet.presentWithPaymentIntent(
                                paymentIntentClientSecret = secret,
                                configuration = PaymentSheet.Configuration(
                                    merchantDisplayName = "SwiftCause",
                                    allowsDelayedPaymentMethods = false,
                                    billingDetailsCollectionConfiguration = PaymentSheet.BillingDetailsCollectionConfiguration(
                                        name = PaymentSheet.BillingDetailsCollectionConfiguration.CollectionMode.Never,
                                        email = PaymentSheet.BillingDetailsCollectionConfiguration.CollectionMode.Never,
                                        phone = PaymentSheet.BillingDetailsCollectionConfiguration.CollectionMode.Never,
                                        address = PaymentSheet.BillingDetailsCollectionConfiguration.AddressCollectionMode.Never,
                                        attachDefaultsToPaymentMethod = false
                                    )
                                )
                            )
                        }
                        "tap" -> {
                            // Start Tap to Pay collection
                            tapToPayViewModel.collectPayment(secret)
                        }
                    }
                }
            }
            is PaymentState.Success -> {
                val success = paymentState as PaymentState.Success
                Toast.makeText(
                    context,
                    "Donation successful! Thank you for your support.",
                    Toast.LENGTH_LONG
                ).show()
                viewModel.clearSelectedCampaign()
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
                pendingDonation = null
            }
            is PaymentState.Error -> {
                val error = paymentState as PaymentState.Error
                Toast.makeText(
                    context,
                    "Payment failed: ${error.message}",
                    Toast.LENGTH_LONG
                ).show()
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
            }
            is PaymentState.Cancelled -> {
                Toast.makeText(
                    context,
                    "Payment cancelled",
                    Toast.LENGTH_SHORT
                ).show()
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
            }
            else -> { /* Idle or Loading */ }
        }
    }
    
    // Handle Tap to Pay state changes
    LaunchedEffect(tapToPayState) {
        when (tapToPayState) {
            is TapToPayState.PaymentSuccess -> {
                Toast.makeText(
                    context,
                    "Tap to Pay donation successful! Thank you!",
                    Toast.LENGTH_LONG
                ).show()
                viewModel.clearSelectedCampaign()
                paymentViewModel.resetPayment()
                tapToPayViewModel.reset()
                selectedPaymentMethod = null
                pendingDonation = null
            }
            is TapToPayState.Error -> {
                val error = tapToPayState as TapToPayState.Error
                Toast.makeText(
                    context,
                    "Tap to Pay failed: ${error.message}",
                    Toast.LENGTH_LONG
                ).show()
                tapToPayViewModel.reset()
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
            }
            else -> { /* Other states */ }
        }
    }
    
    LaunchedEffect(kioskSession) {
        viewModel.loadCampaigns(kioskSession)
    }
    
    // Show loading overlay when payment intent is being created
    Box(modifier = modifier.fillMaxSize()) {
        when {
            uiState.selectedCampaign != null -> {
                val campaign = uiState.selectedCampaign!!
                CampaignDetailsScreen(
                    campaign = campaign,
                    onBackClick = { viewModel.clearSelectedCampaign() },
                    onDonateClick = { amount, isRecurring, interval ->
                        // Store pending donation and show payment method selection
                        pendingDonation = PendingDonation(
                            campaign = campaign,
                            amount = amount,
                            isRecurring = isRecurring,
                            interval = interval
                        )
                        selectedPaymentMethod = null // Trigger payment method selection
                    }
                )
            }
            uiState.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.error != null -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
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
                    onAmountClick = { campaign, amount ->
                        // Quick donate: show payment method selection
                        pendingDonation = PendingDonation(
                            campaign = campaign,
                            amount = amount * 100, // Convert to minor units
                            isRecurring = false,
                            interval = null
                        )
                        selectedPaymentMethod = null // Trigger payment method selection
                    },
                    onDonateClick = { campaign ->
                        viewModel.selectCampaign(campaign)
                    }
                )
            }
        }
        
        // Modern loading overlay when preparing payment intent
        if (paymentState is PaymentState.Loading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.6f))
                    .clickable(enabled = false) {}, // Block interactions
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.material3.Surface(
                    modifier = Modifier
                        .padding(32.dp)
                        .width(280.dp),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                    color = androidx.compose.ui.graphics.Color.White,
                    shadowElevation = 8.dp,
                    tonalElevation = 2.dp
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(vertical = 40.dp, horizontal = 24.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(48.dp),
                            color = MaterialTheme.colorScheme.primary,
                            strokeWidth = 4.dp
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        Text(
                            text = "Preparing Payment",
                            fontSize = 18.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        Text(
                            text = "Please wait...",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
            }
        }
        
        // Payment method selection dialog
        if (pendingDonation != null && selectedPaymentMethod == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.6f))
                    .clickable(enabled = false) {},
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.material3.Surface(
                    modifier = Modifier
                        .padding(32.dp)
                        .width(320.dp),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                    color = androidx.compose.ui.graphics.Color.White,
                    shadowElevation = 8.dp
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Text(
                            text = "Choose Payment Method",
                            fontSize = 20.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        // Card Entry Button
                        Button(
                            onClick = {
                                selectedPaymentMethod = "card"
                                pendingDonation?.let { donation ->
                                    handleDonation(
                                        campaign = donation.campaign,
                                        amount = donation.amount,
                                        isRecurring = donation.isRecurring,
                                        interval = donation.interval,
                                        paymentViewModel = paymentViewModel
                                    )
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            Text(
                                text = "💳 Enter Card Details",
                                fontSize = 16.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Tap to Pay Button (only if reader connected)
                        val readerReady = tapToPayState is TapToPayState.ReaderConnected
                        OutlinedButton(
                            onClick = {
                                selectedPaymentMethod = "tap"
                                pendingDonation?.let { donation ->
                                    handleDonation(
                                        campaign = donation.campaign,
                                        amount = donation.amount,
                                        isRecurring = donation.isRecurring,
                                        interval = donation.interval,
                                        paymentViewModel = paymentViewModel
                                    )
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            enabled = readerReady,
                            border = BorderStroke(
                                width = 2.dp,
                                color = if (readerReady) MaterialTheme.colorScheme.primary 
                                       else MaterialTheme.colorScheme.outline
                            )
                        ) {
                            Text(
                                text = if (readerReady) "📱 Tap Card on Phone" 
                                       else "📱 Tap to Pay (Initializing...)",
                                fontSize = 16.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Cancel button
                        androidx.compose.material3.TextButton(
                            onClick = {
                                pendingDonation = null
                                selectedPaymentMethod = null
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Cancel", fontSize = 14.sp)
                        }
                    }
                }
            }
        }
        
        // Tap to Pay waiting overlay
        when (tapToPayState) {
            is TapToPayState.WaitingForCard -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.8f))
                        .clickable(enabled = false) {},
                    contentAlignment = Alignment.Center
                ) {
                    androidx.compose.material3.Surface(
                        modifier = Modifier
                            .padding(32.dp)
                            .width(300.dp),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                        color = androidx.compose.ui.graphics.Color.White,
                        shadowElevation = 8.dp
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(vertical = 48.dp, horizontal = 24.dp)
                        ) {
                            // Large emoji icon for tap to pay
                            Text(
                                text = "📱",
                                fontSize = 80.sp,
                                modifier = Modifier.padding(bottom = 24.dp)
                            )
                            
                            Text(
                                text = "Tap Card on Phone",
                                fontSize = 22.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            Text(
                                text = "Hold your card near the top of the device",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            }
            is TapToPayState.ProcessingPayment -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.6f))
                        .clickable(enabled = false) {},
                    contentAlignment = Alignment.Center
                ) {
                    androidx.compose.material3.Surface(
                        modifier = Modifier
                            .padding(32.dp)
                            .width(280.dp),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                        color = androidx.compose.ui.graphics.Color.White,
                        shadowElevation = 8.dp
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(vertical = 40.dp, horizontal = 24.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(48.dp),
                                color = MaterialTheme.colorScheme.primary,
                                strokeWidth = 4.dp
                            )
                            
                            Spacer(modifier = Modifier.height(24.dp))
                            
                            Text(
                                text = "Processing Payment",
                                fontSize = 18.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            Text(
                                text = "Please wait...",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                        }
                    }
                }
            }
            else -> {}
        }
    }
}

/**
 * Handles donation by preparing payment intent
 */
private fun handleDonation(
    campaign: Campaign,
    amount: Long,
    isRecurring: Boolean,
    interval: String?,
    paymentViewModel: PaymentViewModel
) {
    android.util.Log.d("MainActivity", "=== Donation Button Clicked ===")
    android.util.Log.d("MainActivity", "Campaign: ${campaign.title}")
    android.util.Log.d("MainActivity", "Campaign ID: ${campaign.id}")
    android.util.Log.d("MainActivity", "Organization ID: ${campaign.organizationId}")
    android.util.Log.d("MainActivity", "Amount: $amount cents")
    android.util.Log.d("MainActivity", "Currency: ${campaign.currency}")
    android.util.Log.d("MainActivity", "Is Recurring: $isRecurring")
    android.util.Log.d("MainActivity", "Interval: $interval")
    
    // Get currency from campaign
    val currency = campaign.currency.lowercase()
    
    // Determine frequency for backend
    val frequency = if (isRecurring) {
        when (interval) {
            "monthly" -> "month"
            "yearly" -> "year"
            else -> "month"
        }
    } else {
        null  // One-time donation
    }
    
    android.util.Log.d("MainActivity", "Calling PaymentViewModel.preparePayment()")
    
    // Prepare payment
    paymentViewModel.preparePayment(
        amount = amount,
        currency = currency,
        campaignId = campaign.id,
        campaignTitle = campaign.title,
        organizationId = campaign.organizationId,
        isAnonymous = true,  // Kiosk donations are anonymous by default
        frequency = frequency
    )
}
