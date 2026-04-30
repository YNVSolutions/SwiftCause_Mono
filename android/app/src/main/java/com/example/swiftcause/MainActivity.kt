package com.example.swiftcause

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.nfc.NfcAdapter
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
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
import coil.compose.AsyncImage
import com.stripe.android.PaymentConfiguration
import com.stripe.android.paymentsheet.PaymentSheet
import com.stripe.android.paymentsheet.PaymentSheetResult
import com.stripe.android.paymentsheet.rememberPaymentSheet
import kotlinx.coroutines.delay

private const val IDLE_SCREENSAVER_TIMEOUT_MS = 60_000L

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
                    AppEntryPoint(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}

@Composable
private fun AppEntryPoint(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? ComponentActivity
    var kioskSession by remember { mutableStateOf<KioskSession?>(null) }
    var continueWithoutLocation by remember { mutableStateOf(false) }
    var hasRequestedLocationPermission by remember { mutableStateOf(false) }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasRequestedLocationPermission = true
        hasLocationPermission = isGranted
    }

    LaunchedEffect(hasLocationPermission, hasRequestedLocationPermission, continueWithoutLocation) {
        if (!hasLocationPermission && !hasRequestedLocationPermission && !continueWithoutLocation) {
            hasRequestedLocationPermission = true
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    val shouldShowLocationRationale = remember(hasLocationPermission, hasRequestedLocationPermission, activity) {
        !hasLocationPermission &&
            hasRequestedLocationPermission &&
            activity != null &&
            ActivityCompat.shouldShowRequestPermissionRationale(
                activity,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
    }

    if (!hasLocationPermission && !continueWithoutLocation) {
        LocationPermissionRequiredScreen(
            showRationale = shouldShowLocationRationale || !hasRequestedLocationPermission,
            onRequestPermission = {
                locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            },
            onOpenSettings = {
                val intent = Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", context.packageName, null)
                )
                context.startActivity(intent)
            },
            onContinueWithoutLocation = {
                continueWithoutLocation = true
            }
        )
        return
    }

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
                hasLocationPermission = hasLocationPermission,
                modifier = modifier
            )
        }
    }
}

@Composable
fun KioskMainContent(
    kioskSession: KioskSession,
    hasLocationPermission: Boolean,
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
    val appName = stringResource(R.string.app_name)
    val hasNfcCapability = remember(context) { NfcAdapter.getDefaultAdapter(context) != null }
    val accentColor = remember(uiState.organizationAccentColorHex) {
        parseAccentColorOrNull(uiState.organizationAccentColorHex)
    } ?: MaterialTheme.colorScheme.primary
    val idleImageUrl = uiState.organizationIdleImageUrl?.trim().orEmpty()

    // Track selected payment method (null = show selection, "card" or "tap")
    var selectedPaymentMethod by remember { mutableStateOf<String?>(null) }
    var pendingDonation by remember { mutableStateOf<PendingDonation?>(null) }
    var showThankYouScreen by remember { mutableStateOf(false) }
    var thankYouData by remember { mutableStateOf<ThankYouData?>(null) }
    var lastInteractionAtMs by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    var showIdleScreensaver by remember { mutableStateOf(false) }

    val canShowIdleScreensaver = idleImageUrl.isNotEmpty() &&
        !showThankYouScreen &&
        paymentState !is PaymentState.Loading &&
        paymentState !is PaymentState.Ready &&
        tapToPayState !is TapToPayState.WaitingForCard &&
        tapToPayState !is TapToPayState.ProcessingPayment

    // Initialize campaigns immediately, independent of Tap to Pay permissions.
    LaunchedEffect(kioskSession) {
        viewModel.loadCampaigns(kioskSession)
        viewModel.startPolling(kioskSession)
    }

    // Initialize Tap to Pay only when location permission is available.
    LaunchedEffect(hasLocationPermission) {
        if (hasLocationPermission) {
            val isDebuggable = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            tapToPayViewModel.initializeTapToPay(isSimulated = isDebuggable)
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
                                    merchantDisplayName = appName,
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
                                    context.getString(R.string.tap_to_pay_unavailable_switching_card),
                                    Toast.LENGTH_SHORT
                                ).show()
                                paymentSheet.presentWithPaymentIntent(
                                    paymentIntentClientSecret = secret,
                                    configuration = PaymentSheet.Configuration(
                                        merchantDisplayName = appName,
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
                    context.getString(R.string.tap_to_pay_failed, error.message),
                    Toast.LENGTH_LONG
                ).show()
                tapToPayViewModel.reset()
                paymentViewModel.resetPayment()
                selectedPaymentMethod = null
            }
            else -> { /* Other states */ }
        }
    }

    LaunchedEffect(canShowIdleScreensaver) {
        if (!canShowIdleScreensaver) {
            showIdleScreensaver = false
        }
    }

    LaunchedEffect(lastInteractionAtMs, canShowIdleScreensaver, showIdleScreensaver) {
        if (!canShowIdleScreensaver || showIdleScreensaver) return@LaunchedEffect
        delay(IDLE_SCREENSAVER_TIMEOUT_MS)
        val idleForMs = SystemClock.elapsedRealtime() - lastInteractionAtMs
        if (canShowIdleScreensaver && idleForMs >= IDLE_SCREENSAVER_TIMEOUT_MS) {
            showIdleScreensaver = true
        }
    }

    // Show loading overlay when payment intent is being created
    Box(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(canShowIdleScreensaver, showIdleScreensaver) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        val interacted = event.changes.any { it.pressed || it.positionChanged() }
                        if (!interacted) continue

                        val now = SystemClock.elapsedRealtime()
                        if (showIdleScreensaver || now - lastInteractionAtMs > 350L) {
                            lastInteractionAtMs = now
                            if (showIdleScreensaver) {
                                showIdleScreensaver = false
                            }
                        }
                    }
                }
            }
    ) {
        val hasSingleCampaign = uiState.campaigns.size == 1
        val activeCampaign = uiState.selectedCampaign ?: if (hasSingleCampaign) uiState.campaigns.first() else null

        when {
            activeCampaign != null -> {
                val campaign = activeCampaign
                CampaignDetailsScreen(
                    campaign = campaign,
                    accentColorHex = uiState.organizationAccentColorHex,
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

                        val canUseTapToPay = hasNfcCapability && hasLocationPermission && tapToPayViewModel.isReaderReady()
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
                    Text(text = uiState.error ?: stringResource(R.string.campaign_list_error))
                }
            }
            else -> {
                CampaignListScreen(
                    campaigns = uiState.campaigns,
                    isLoading = uiState.isLoading,
                    organizationDisplayName = uiState.organizationDisplayName,
                    organizationLogoUrl = uiState.organizationLogoUrl,
                    accentColorHex = uiState.organizationAccentColorHex,
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
                            color = accentColor,
                            strokeWidth = 4.dp
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Text(
                            text = stringResource(R.string.preparing_payment),
                            fontSize = 18.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = stringResource(R.string.please_wait),
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
                                    color = accentColor,
                                    strokeWidth = 4.dp
                                )

                                Spacer(modifier = Modifier.height(24.dp))

                                Text(
                                    text = stringResource(R.string.processing_payment_title),
                                    fontSize = 18.sp,
                                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )

                                Spacer(modifier = Modifier.height(8.dp))

                                Text(
                                    text = stringResource(R.string.please_wait),
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
                                    contentDescription = stringResource(R.string.tap_to_pay_content_description),
                                    tint = accentColor,
                                    modifier = Modifier
                                        .size(72.dp)
                                        .padding(bottom = 24.dp)
                                )

                                Text(
                                    text = stringResource(R.string.tap_card_on_phone),
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
                                color = accentColor,
                                strokeWidth = 4.dp
                            )

                            Spacer(modifier = Modifier.height(24.dp))

                            Text(
                                text = stringResource(R.string.processing_payment_title),
                                fontSize = 18.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = stringResource(R.string.please_wait),
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
                customThankYouMessage = uiState.organizationThankYouMessage,
                accentColorHex = uiState.organizationAccentColorHex,
                magicLinkToken = magicLinkToken,
                onDismiss = {
                    showThankYouScreen = false
                    thankYouData = null
                    pendingDonation = null
                    viewModel.clearSelectedCampaign()
                }
            )
        }

        if (showIdleScreensaver) {
            IdleScreensaverOverlay(
                imageUrl = idleImageUrl,
                onDismiss = {
                    showIdleScreensaver = false
                    lastInteractionAtMs = SystemClock.elapsedRealtime()
                }
            )
        }
    }
}

@Composable
private fun LocationPermissionRequiredScreen(
    showRationale: Boolean,
    onRequestPermission: () -> Unit,
    onOpenSettings: () -> Unit,
    onContinueWithoutLocation: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth(),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
            shadowElevation = 8.dp,
            tonalElevation = 2.dp,
            color = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Contactless,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(48.dp)
                )

                Text(
                    text = stringResource(R.string.location_permission_title),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                )


                Text(
                    text = if (showRationale) {
                        stringResource(R.string.location_permission_message_rationale)
                    } else {
                        stringResource(R.string.location_permission_message_denied)
                    },
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.9f),
                    textAlign = TextAlign.Center
                )

                Text(
                    text = stringResource(R.string.location_permission_continue_without_note),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(4.dp))

                Button(
                    onClick = if (showRationale) onRequestPermission else onOpenSettings,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = if (showRationale) {
                            stringResource(R.string.grant_location_permission)
                        } else {
                            stringResource(R.string.open_settings)
                        }
                    )
                }

                OutlinedButton(
                    onClick = onContinueWithoutLocation,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = stringResource(R.string.continue_without_location),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun IdleScreensaverOverlay(
    imageUrl: String,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable { onDismiss() }
    ) {
        AsyncImage(
            model = imageUrl,
            contentDescription = stringResource(R.string.idle_screensaver_image_content_description),
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        Text(
            text = stringResource(R.string.tap_to_continue),
            color = Color.White,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp),
            fontSize = 14.sp
        )
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

private fun parseAccentColorOrNull(hex: String?): Color? {
    val value = hex?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return try {
        Color(android.graphics.Color.parseColor(value))
    } catch (_: IllegalArgumentException) {
        null
    }
}
