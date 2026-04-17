package com.example.swiftcause

import android.Manifest
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import com.example.swiftcause.presentation.screens.ThankYouScreen
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

data class PendingDonation(
    val campaign: Campaign,
    val amount: Long,
    val isRecurring: Boolean,
    val interval: String?,
    val email: String? = null
)

data class ThankYouData(
    val campaignTitle: String,
    val amount: Long,
    val currency: String,
    val paymentIntentId: String
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
    val isTapToPaySimulated by tapToPayViewModel.isSimulatedMode.collectAsState()
    val context = LocalContext.current
    val hasNfcCapability = remember(context) { NfcAdapter.getDefaultAdapter(context) != null }

    // Track selected payment method (null = show selection, "card" or "tap")
    var selectedPaymentMethod by remember { mutableStateOf<String?>(null) }
    var pendingDonation by remember { mutableStateOf<PendingDonation?>(null) }
    var showThankYouScreen by remember { mutableStateOf(false) }
    var thankYouData by remember { mutableStateOf<ThankYouData?>(null) }

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
        viewModel.loadCampaigns(kioskSession)
        viewModel.startPolling(kioskSession)
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
        paymentViewModel.handlePaymentResult(result) {
            viewModel.loadCampaigns(kioskSession)
        }
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
                            if (tapToPayViewModel.isReaderReady()) {
                                // Start Tap to Pay collection
                                tapToPayViewModel.collectPayment(secret)
                            } else {
                                // Reader not ready anymore; fallback to card entry.
                                selectedPaymentMethod = "card"
                                Toast.makeText(
                                    context,
                                    "Tap to Pay unavailable. Switching to card entry.",
                                    Toast.LENGTH_SHORT
                                ).show()
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
                        }
                    }
                }
            }
            is PaymentState.Success -> {
                val success = paymentState as PaymentState.Success

                // Extract payment intent ID from transaction ID (format: "pi_xxx" or full client secret)
                val paymentIntentId = success.transactionId.split("_secret").firstOrNull() ?: success.transactionId

                // Fetch magic link token from Firestore
                paymentViewModel.fetchMagicLinkToken(paymentIntentId)

                // Show Thank You screen with payment details
                thankYouData = ThankYouData(
                    campaignTitle = pendingDonation?.campaign?.title ?: "Campaign",
                    amount = success.amount,
                    currency = success.currency,
                    paymentIntentId = paymentIntentId
                )
                showThankYouScreen = true

                // Clear payment state but keep pending donation for thank you screen
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
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
                val tapSuccess = tapToPayState as TapToPayState.PaymentSuccess
                val paymentIntentId = tapSuccess.paymentIntent.id ?: ""

                // Fetch magic link token
                paymentViewModel.fetchMagicLinkToken(paymentIntentId)

                // Show Thank You screen
                thankYouData = ThankYouData(
                    campaignTitle = pendingDonation?.campaign?.title ?: "Campaign",
                    amount = pendingDonation?.amount ?: 0L,
                    currency = pendingDonation?.campaign?.currency ?: "gbp",
                    paymentIntentId = paymentIntentId
                )
                showThankYouScreen = true

                tapToPayViewModel.reset()
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
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
        val hasSingleCampaign = uiState.campaigns.size == 1
        val activeCampaign = uiState.selectedCampaign ?: if (hasSingleCampaign) uiState.campaigns.first() else null

        when {
            activeCampaign != null -> {
                val campaign = activeCampaign
                CampaignDetailsScreen(
                    campaign = campaign,
                    onBackClick = {
                        if (!hasSingleCampaign) {
                            viewModel.clearSelectedCampaign()
                        }
                    },
                    onDonateClick = { amount, isRecurring, interval, email ->
                        // Auto-route payment method based on NFC capability:
                        // NFC-capable device -> Tap to Pay, otherwise -> Card details.
                        pendingDonation = PendingDonation(
                            campaign = campaign,
                            amount = amount,
                            isRecurring = isRecurring,
                            interval = interval,
                            email = email
                        )

                        val canUseTapToPay = hasNfcCapability && tapToPayViewModel.isReaderReady()
                        selectedPaymentMethod = if (canUseTapToPay) "tap" else "card"
                        handleDonation(
                            campaign = campaign,
                            amount = amount,
                            isRecurring = isRecurring,
                            interval = interval,
                            email = email,
                            paymentViewModel = paymentViewModel,
                            kioskSession = kioskSession
                        )
                    }
                )
            }
            uiState.isLoading && uiState.campaigns.isEmpty() -> {
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
                    isLoading = uiState.isLoading,
                    onCampaignClick = { campaign ->
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

        // Tap to Pay waiting overlay
        when (tapToPayState) {
            is TapToPayState.WaitingForCard -> {
                if (isTapToPaySimulated) {
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
                } else {
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
                                Icon(
                                    imageVector = Icons.Filled.Contactless,
                                    contentDescription = "Tap to Pay",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier
                                        .size(72.dp)
                                        .padding(bottom = 24.dp)
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

        // Thank You Screen overlay (shown after successful payment)
        val currentThankYouData = thankYouData
        if (showThankYouScreen && currentThankYouData != null) {
            val magicLinkToken by paymentViewModel.magicLinkToken.collectAsState()

            ThankYouScreen(
                thankYouData = currentThankYouData,
                magicLinkToken = magicLinkToken,
                onDismiss = {
                    showThankYouScreen = false
                    thankYouData = null
                    pendingDonation = null
                    viewModel.clearSelectedCampaign()
                }
            )
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
    email: String?,
    paymentViewModel: PaymentViewModel,
    kioskSession: KioskSession?
) {
    android.util.Log.d("MainActivity", "=== Donation Button Clicked ===")
    android.util.Log.d("MainActivity", "Campaign: ${campaign.title}")
    android.util.Log.d("MainActivity", "Campaign ID: ${campaign.id}")
    android.util.Log.d("MainActivity", "Organization ID: ${campaign.organizationId}")
    android.util.Log.d("MainActivity", "Amount: $amount cents")
    android.util.Log.d("MainActivity", "Currency: ${campaign.currency}")
    android.util.Log.d("MainActivity", "Is Recurring: $isRecurring")
    android.util.Log.d("MainActivity", "Interval: $interval")
    android.util.Log.d("MainActivity", "Email provided: ${!email.isNullOrBlank()}")

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
        donorEmail = email,
        isAnonymous = email == null,  // Anonymous if no email provided
        frequency = frequency,
        isGiftAid = campaign.isGiftAid,  // Pass Gift Aid flag for magic link generation
        kioskId = kioskSession?.kioskId
    )
}
