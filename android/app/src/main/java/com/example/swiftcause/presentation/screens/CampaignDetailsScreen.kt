package com.example.swiftcause.presentation.screens

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import com.example.swiftcause.R
import com.example.swiftcause.ui.components.SkeletonBox
import com.example.swiftcause.domain.models.Campaign
import com.example.swiftcause.ui.theme.PremiumBody
import com.example.swiftcause.ui.theme.PremiumBorder
import com.example.swiftcause.ui.theme.PremiumCardSurface
import com.example.swiftcause.ui.theme.PremiumHeadline
import com.example.swiftcause.ui.theme.PremiumPageBackground
import com.example.swiftcause.ui.theme.PremiumPanelSurface
import com.example.swiftcause.ui.theme.PremiumPrimary
import com.example.swiftcause.ui.theme.PremiumPrimaryPressed
import com.example.swiftcause.ui.theme.PremiumUnselectedFill
import com.example.swiftcause.utils.CurrencyFormatter
import kotlinx.coroutines.delay
import coil.request.ImageRequest

@Composable
fun CampaignDetailsScreen(
    campaign: Campaign,
    onBackClick: () -> Unit,
    onDonateClick: (amount: Long, isRecurring: Boolean, interval: String?, email: String?) -> Unit,
    showBackButton: Boolean = true // New parameter to control back button visibility
) {
    android.util.Log.d("CampaignDetails", "Screen rendered for campaign: ${campaign.title}, videoUrl: '${campaign.videoUrl}'")

    val context = LocalContext.current
    var selectedAmount by remember { mutableLongStateOf(0L) }
    var customAmount by remember { mutableStateOf("") }
    var isRecurring by remember { mutableStateOf(false) }
    var selectedInterval by remember { mutableStateOf("monthly") }
    var recurringEmail by remember { mutableStateOf("") }
    var currentImageIndex by remember { mutableIntStateOf(0) }
    var isLongDescriptionExpanded by remember { mutableStateOf(false) }

    val images = campaign.getAllImages()
    val scrollState = rememberScrollState()
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    val panelLift by animateDpAsState(
        targetValue = if (imeBottom > 0) 72.dp else 0.dp,
        animationSpec = tween(durationMillis = 220),
        label = "panel-lift"
    )

    // Auto-rotate carousel
    LaunchedEffect(images.size) {
        if (images.size > 1) {
            while (true) {
                delay(5000)
                currentImageIndex = (currentImageIndex + 1) % images.size
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(PremiumPageBackground)
                .verticalScroll(scrollState)
                .padding(bottom = 340.dp)
        ) {
            // Header with back button
            if (showBackButton) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .clickable { onBackClick() }
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.content_description_back_button),
                            tint = PremiumPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = stringResource(R.string.back),
                            color = PremiumPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Image Carousel
            ImageCarousel(
                images = images,
                currentIndex = currentImageIndex,
                onIndexChange = { currentImageIndex = it },
                campaignTitle = campaign.title,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Campaign Title + Summary
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Text(
                    text = campaign.title,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Medium,
                    color = PremiumHeadline,
                    lineHeight = 28.sp
                )

                if (campaign.shortDescription.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = campaign.shortDescription,
                        fontSize = 14.sp,
                        color = PremiumBody,
                        lineHeight = 20.sp
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
                ProgressSection(campaign = campaign)
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Collapsible long description
            if (campaign.longDescription.isNotEmpty()) {
                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = if (isLongDescriptionExpanded) "Hide details" else stringResource(R.string.about_campaign),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { isLongDescriptionExpanded = !isLongDescriptionExpanded }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PremiumPrimary
                )

                if (isLongDescriptionExpanded) {
                    RichTextContent(
                        htmlContent = campaign.longDescription,
                        textColor = PremiumBody,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                    )
                }
            }
        }

        // Fixed Bottom Donation Panel (primary focus)
        DonationPanel(
            campaign = campaign,
            selectedAmount = selectedAmount,
            customAmount = customAmount,
            isRecurring = isRecurring,
            selectedInterval = selectedInterval,
            recurringEmail = recurringEmail,
            onAmountSelected = {
                selectedAmount = it
                customAmount = ""
            },
            onCustomAmountChanged = {
                customAmount = it
                selectedAmount = 0L
            },
            onRecurringToggle = { isRecurring = it },
            onIntervalSelected = { selectedInterval = it },
            onRecurringEmailChanged = { recurringEmail = it },
            onAmountDonateClick = { amountInMinorUnits ->
                onDonateClick(
                    amountInMinorUnits,
                    isRecurring,
                    if (isRecurring) selectedInterval else null,
                    if (isRecurring) recurringEmail else null
                )
            },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .offset(y = -panelLift)
        )
    }
}

@Composable
private fun ImageCarousel(
    images: List<String>,
    currentIndex: Int,
    onIndexChange: (Int) -> Unit,
    campaignTitle: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    Box(modifier = modifier) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp),
            shape = RoundedCornerShape(10.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Box {
                SubcomposeAsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(images.getOrNull(currentIndex) ?: "")
                        .crossfade(true)
                        .build(),
                    contentDescription = stringResource(R.string.content_description_campaign_image, campaignTitle),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                ) {
                    val state = painter.state
                    if (state is AsyncImagePainter.State.Loading || state is AsyncImagePainter.State.Empty) {
                        SkeletonBox(
                            modifier = Modifier.fillMaxSize(),
                            shape = RoundedCornerShape(0.dp)
                        )
                    } else {
                        SubcomposeAsyncImageContent()
                    }
                }

                // Gradient overlay at bottom
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.3f))
                            )
                        )
                )

                // Navigation arrows (only if multiple images)
                if (images.size > 1) {
                    // Left arrow
                    IconButton(
                        onClick = {
                            onIndexChange((currentIndex - 1 + images.size) % images.size)
                        },
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .padding(start = 8.dp)
                            .size(40.dp)
                            .shadow(4.dp, CircleShape)
                            .background(Color.White.copy(alpha = 0.9f), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                            contentDescription = stringResource(R.string.content_description_previous_image),
                            tint = PremiumPrimary
                        )
                    }

                    // Right arrow
                    IconButton(
                        onClick = {
                            onIndexChange((currentIndex + 1) % images.size)
                        },
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .padding(end = 8.dp)
                            .size(40.dp)
                            .shadow(4.dp, CircleShape)
                            .background(Color.White.copy(alpha = 0.9f), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = stringResource(R.string.content_description_next_image),
                            tint = PremiumPrimary
                        )
                    }

                    // Dot indicators
                    Row(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        images.forEachIndexed { index, _ ->
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (index == currentIndex) PremiumPrimary
                                        else Color.White.copy(alpha = 0.6f)
                                    )
                                    .clickable { onIndexChange(index) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProgressSection(
    campaign: Campaign,
    modifier: Modifier = Modifier
) {
    val progress = campaign.getProgressPercentage()
    val animatedProgress by animateFloatAsState(
        targetValue = progress / 100f,
        label = "progress"
    )

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PremiumCardSurface, RoundedCornerShape(12.dp))
            .border(1.dp, PremiumBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.community_support),
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = PremiumBody
            )
            Text(
                text = "${progress.toInt()}%",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PremiumPrimary
            )
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Progress bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(PremiumBorder)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animatedProgress)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(4.dp))
                    .background(PremiumPrimary)
            )
        }

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = stringResource(
                R.string.raised_of_goal,
                CurrencyFormatter.formatCurrency(campaign.raised, campaign.currency),
                CurrencyFormatter.formatCurrencyFromMajor(campaign.goal, campaign.currency)
            ),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = PremiumBody
        )
    }
}

@Composable
private fun DonationPanel(
    campaign: Campaign,
    selectedAmount: Long,
    customAmount: String,
    isRecurring: Boolean,
    selectedInterval: String,
    recurringEmail: String,
    onAmountSelected: (Long) -> Unit,
    onCustomAmountChanged: (String) -> Unit,
    onRecurringToggle: (Boolean) -> Unit,
    onIntervalSelected: (String) -> Unit,
    onRecurringEmailChanged: (String) -> Unit,
    onAmountDonateClick: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    val amounts = campaign.predefinedAmounts.ifEmpty { listOf(10L, 25L, 50L, 100L, 250L, 500L) }

    // Validate: amount > 0, and if recurring, email must be valid
    val isValidEmail = recurringEmail.contains("@") && recurringEmail.contains(".")
    val customAmountMajor = customAmount.toLongOrNull() ?: 0L
    val canConfirmCustomAmount = customAmountMajor > 0L && (!isRecurring || isValidEmail)

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = 10.dp,
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                spotColor = Color.Black.copy(alpha = 0.08f)
            ),
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        color = PremiumPanelSurface,
        tonalElevation = 2.dp,
        border = BorderStroke(1.dp, PremiumBorder)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp)
        ) {
            // Amount label
            Text(
                text = stringResource(R.string.choose_amount),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PremiumPrimary
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Amount buttons - evenly distributed
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                amounts.take(3).forEach { amount ->
                    AmountButton(
                        amount = amount,
                        currency = campaign.currency,
                        isSelected = selectedAmount == amount,
                        onClick = {
                            onAmountSelected(amount)
                            if (!isRecurring || isValidEmail) {
                                onAmountDonateClick(amount * 100)
                            }
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (amounts.size > 3) {
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    amounts.drop(3).take(3).forEach { amount ->
                        AmountButton(
                            amount = amount,
                            currency = campaign.currency,
                            isSelected = selectedAmount == amount,
                            onClick = {
                                onAmountSelected(amount)
                                if (!isRecurring || isValidEmail) {
                                    onAmountDonateClick(amount * 100)
                                }
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Custom amount input
            OutlinedTextField(
                value = customAmount,
                onValueChange = {
                    if (it.all { char -> char.isDigit() }) {
                        onCustomAmountChanged(it)
                    }
                },
                textStyle = LocalTextStyle.current.copy(
                    fontSize = 16.sp,
                    lineHeight = 20.sp,
                    color = PremiumHeadline
                ),
                placeholder = {
                    Text(
                        text = stringResource(R.string.custom_amount),
                        color = PremiumBody.copy(alpha = 0.75f),
                        fontSize = 16.sp,
                        lineHeight = 20.sp
                    )
                },
                leadingIcon = {
                    Text(
                        text = CurrencyFormatter.getCurrencySymbol(campaign.currency),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PremiumBody
                    )
                },
                trailingIcon = {
                    AnimatedVisibility(
                        visible = canConfirmCustomAmount,
                        enter = fadeIn() + scaleIn(initialScale = 0.85f),
                        exit = fadeOut() + scaleOut(targetScale = 0.85f)
                    ) {
                        Button(
                            onClick = { onAmountDonateClick(customAmountMajor * 100) },
                            modifier = Modifier.height(44.dp).padding(end = 6.dp),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PremiumPrimary,
                                contentColor = Color.White
                            )
                        ) {
                            Text(
                                text = stringResource(R.string.donate),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedBorderColor = PremiumBorder,
                    focusedBorderColor = PremiumPrimary,
                    unfocusedContainerColor = PremiumCardSurface,
                    focusedContainerColor = PremiumCardSurface,
                    focusedLeadingIconColor = PremiumBody,
                    unfocusedLeadingIconColor = PremiumBody,
                    unfocusedTextColor = PremiumHeadline,
                    focusedTextColor = PremiumHeadline
                ),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )

            // Recurring toggle (if enabled)
            if (campaign.enableRecurring) {
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.make_recurring),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = PremiumHeadline
                    )
                    Switch(
                        checked = isRecurring,
                        onCheckedChange = onRecurringToggle,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = PremiumPrimary,
                            uncheckedThumbColor = Color.White,
                            uncheckedTrackColor = PremiumBorder
                        )
                    )
                }

                // Interval selector
                if (isRecurring) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        IntervalButton(
                            text = stringResource(R.string.monthly),
                            isSelected = selectedInterval == "monthly",
                            onClick = { onIntervalSelected("monthly") },
                            modifier = Modifier.weight(1f)
                        )
                        IntervalButton(
                            text = stringResource(R.string.quarterly),
                            isSelected = selectedInterval == "quarterly",
                            onClick = { onIntervalSelected("quarterly") },
                            modifier = Modifier.weight(1f)
                        )
                        IntervalButton(
                            text = stringResource(R.string.yearly),
                            isSelected = selectedInterval == "yearly",
                            onClick = { onIntervalSelected("yearly") },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Email input for recurring donations
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = recurringEmail,
                        onValueChange = onRecurringEmailChanged,
                        label = { Text("Email Address *") },
                        placeholder = { Text("Required to manage your subscription") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PremiumPrimary,
                            focusedLabelColor = PremiumPrimary,
                            unfocusedBorderColor = PremiumBorder,
                            unfocusedContainerColor = PremiumCardSurface,
                            focusedContainerColor = PremiumCardSurface,
                            unfocusedTextColor = PremiumHeadline,
                            focusedTextColor = PremiumHeadline
                        )
                    )
                    Text(
                        text = "We need your email to send you subscription management links",
                        fontSize = 12.sp,
                        color = PremiumBody,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }

        }
    }
}

@Composable
private fun AmountButton(
    amount: Long,
    currency: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected) PremiumPrimaryPressed else PremiumPrimary,
        label = "bg"
    )
    val textColor by animateColorAsState(
        targetValue = Color.White,
        label = "text"
    )
    val scale by animateFloatAsState(
        targetValue = if (isSelected) 1.02f else 1f,
        label = "scale"
    )

    Box(
        modifier = modifier
            .scale(scale)
            .height(64.dp)
            .widthIn(min = 80.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(
                width = if (isSelected) 2.dp else 0.dp,
                color = if (isSelected) PremiumPrimary else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = CurrencyFormatter.formatCurrencyFromMajor(amount, currency),
            fontSize = 19.sp,
            fontWeight = FontWeight.SemiBold,
            color = textColor
        )
    }
}

@Composable
private fun IntervalButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected) PremiumPrimary else PremiumCardSurface,
        label = "bg"
    )
    val textColor by animateColorAsState(
        targetValue = if (isSelected) Color.White else PremiumBody,
        label = "text"
    )

    Box(
        modifier = modifier
            .height(40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .border(
                width = if (isSelected) 0.dp else 1.dp,
                color = if (isSelected) Color.Transparent else PremiumBorder,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = textColor
        )
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun YouTubeVideoPlayer(
    videoUrl: String,
    modifier: Modifier = Modifier
) {
    val videoId = extractYouTubeVideoId(videoUrl)
    var isPlaying by remember { mutableStateOf(false) }

    android.util.Log.d("YouTubePlayer", "Video URL: $videoUrl, Extracted ID: $videoId")

    if (videoId != null) {
        Card(
            modifier = modifier,
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Text(
                    text = stringResource(R.string.watch_video),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF0F172A)
                )

                Spacer(modifier = Modifier.height(12.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.Black),
                    contentAlignment = Alignment.Center
                ) {
                    if (isPlaying) {
                        val embedUrl = "https://www.youtube.com/embed/$videoId?autoplay=1&playsinline=1&rel=0"
                        android.util.Log.d("YouTubePlayer", "Loading embed URL: $embedUrl")

                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { context ->
                                android.util.Log.d("YouTubePlayer", "Creating WebView")
                                WebView(context).apply {
                                    setBackgroundColor(android.graphics.Color.BLACK)
                                    setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)

                                    settings.apply {
                                        javaScriptEnabled = true
                                        domStorageEnabled = true
                                        databaseEnabled = true
                                        mediaPlaybackRequiresUserGesture = false
                                        loadWithOverviewMode = true
                                        useWideViewPort = true
                                        builtInZoomControls = false
                                        displayZoomControls = false
                                        mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                        cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                                        allowFileAccess = true
                                        allowContentAccess = true
                                        javaScriptCanOpenWindowsAutomatically = true
                                        setSupportMultipleWindows(false)

                                        // Set desktop User-Agent to bypass mobile restrictions
                                        userAgentString = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                    }

                                    // JavaScript interface for debugging
                                    addJavascriptInterface(object {
                                        @android.webkit.JavascriptInterface
                                        fun log(message: String) {
                                            android.util.Log.d("YouTubePlayer", "JS: $message")
                                        }

                                        @android.webkit.JavascriptInterface
                                        fun onReady() {
                                            android.util.Log.d("YouTubePlayer", "Player ready")
                                        }

                                        @android.webkit.JavascriptInterface
                                        fun onError(error: String) {
                                            android.util.Log.e("YouTubePlayer", "Player error: $error")
                                        }

                                        @android.webkit.JavascriptInterface
                                        fun onStateChange(state: String) {
                                            android.util.Log.d("YouTubePlayer", "Player state: $state")
                                        }
                                    }, "Android")

                                    webChromeClient = object : WebChromeClient() {
                                        override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                                            android.util.Log.d("YouTubePlayer", "Console [${consoleMessage?.messageLevel()}]: ${consoleMessage?.message()}")
                                            return true
                                        }
                                    }

                                    webViewClient = object : WebViewClient() {
                                        override fun onPageFinished(view: WebView?, url: String?) {
                                            android.util.Log.d("YouTubePlayer", "Page finished: $url")
                                        }

                                        override fun onReceivedError(
                                            view: WebView?,
                                            request: android.webkit.WebResourceRequest?,
                                            error: android.webkit.WebResourceError?
                                        ) {
                                            android.util.Log.e("YouTubePlayer", "Error: ${error?.description}, Code: ${error?.errorCode}, URL: ${request?.url}")
                                        }

                                        override fun onReceivedHttpError(
                                            view: WebView?,
                                            request: android.webkit.WebResourceRequest?,
                                            errorResponse: android.webkit.WebResourceResponse?
                                        ) {
                                            android.util.Log.e("YouTubePlayer", "HTTP Error: ${errorResponse?.statusCode}, URL: ${request?.url}")
                                        }
                                    }

                                    // Use YouTube IFrame Player API
                                    val html = """
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                            <style>
                                                * { margin: 0; padding: 0; }
                                                html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
                                                #player { width: 100%; height: 100%; }
                                            </style>
                                        </head>
                                        <body>
                                            <div id="player"></div>
                                            <script>
                                                var tag = document.createElement('script');
                                                tag.src = "https://www.youtube.com/iframe_api";
                                                var firstScriptTag = document.getElementsByTagName('script')[0];
                                                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                                                var player;
                                                function onYouTubeIframeAPIReady() {
                                                    Android.log('YouTube API ready');
                                                    player = new YT.Player('player', {
                                                        videoId: '${videoId}',
                                                        playerVars: {
                                                            'autoplay': 0,
                                                            'playsinline': 1,
                                                            'controls': 1,
                                                            'rel': 0,
                                                            'modestbranding': 1,
                                                            'origin': 'https://www.youtube.com'
                                                        },
                                                        events: {
                                                            'onReady': function(event) {
                                                                Android.onReady();
                                                                Android.log('Player initialized, user can click play');
                                                            },
                                                            'onStateChange': function(event) {
                                                                var states = {'-1': 'UNSTARTED', '0': 'ENDED', '1': 'PLAYING', '2': 'PAUSED', '3': 'BUFFERING', '5': 'CUED'};
                                                                Android.onStateChange(states[event.data] || 'UNKNOWN');
                                                            },
                                                            'onError': function(event) {
                                                                var errors = {2: 'Invalid ID', 5: 'HTML5 error', 100: 'Not found', 101: 'Not embeddable', 150: 'Not embeddable', 152: 'Cannot play in embedded players'};
                                                                Android.onError(errors[event.data] || 'Error: ' + event.data);
                                                            }
                                                        });
                                                }
                                            </script>
                                        </body>
                                        </html>
                                    """.trimIndent()

                                    android.util.Log.d("YouTubePlayer", "Loading YouTube IFrame API")
                                    loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
                                }
                            }
                        )
                    } else {
                        // Thumbnail with play button
                        SubcomposeAsyncImage(
                            model = "https://img.youtube.com/vi/$videoId/hqdefault.jpg",
                            contentDescription = stringResource(R.string.watch_video),
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            val state = painter.state
                            if (state is AsyncImagePainter.State.Loading || state is AsyncImagePainter.State.Empty) {
                                SkeletonBox(
                                    modifier = Modifier.fillMaxSize(),
                                    shape = RoundedCornerShape(12.dp)
                                )
                            } else {
                                SubcomposeAsyncImageContent()
                            }
                        }

                        // Play button
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.7f))
                                .clickable { isPlaying = true },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = stringResource(R.string.play_video),
                                tint = Color.White,
                                modifier = Modifier.size(48.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Renders HTML content with proper styling for rich text.
 * Supports: HTML tags (<p>, <strong>, <em>, <br>, <hr>) and legacy format (**bold**, <br>, <hr>).
 */
@Composable
private fun RichTextContent(
    htmlContent: String,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    // Sanitize HTML content (remove scripts, iframes, event handlers)
    val sanitizedHtml = htmlContent
        .replace(Regex("<script[^>]*>.*?</script>", RegexOption.IGNORE_CASE), "")
        .replace(Regex("<iframe[^>]*>.*?</iframe>", RegexOption.IGNORE_CASE), "")
        .replace(Regex("on\\w+=\"[^\"]*\"", RegexOption.IGNORE_CASE), "")
        .trim()

    if (sanitizedHtml.isEmpty()) return

    // Check if it contains HTML tags
    val containsHtml = Regex("<[^>]+>").containsMatchIn(sanitizedHtml)

    if (containsHtml) {
        // Render as HTML using TextView
        RenderHtmlContent(sanitizedHtml, textColor, modifier)
    } else {
        // Fallback: Handle legacy format (**bold**, <br>, <hr>)
        RenderLegacyFormat(sanitizedHtml, textColor, modifier)
    }
}

@Composable
private fun RenderHtmlContent(
    htmlContent: String,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    AndroidView(
        modifier = modifier.fillMaxWidth(),
        factory = { ctx ->
            android.widget.TextView(ctx).apply {
                textSize = 15f
                setTextColor(textColor.toArgb())
                setLineSpacing(8f, 1f)

                // Parse and set HTML content
                val spanned = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                    android.text.Html.fromHtml(htmlContent, android.text.Html.FROM_HTML_MODE_LEGACY)
                } else {
                    @Suppress("DEPRECATION")
                    android.text.Html.fromHtml(htmlContent)
                }
                text = spanned

                setLinkTextColor(PremiumPrimary.toArgb())
                movementMethod = android.text.method.LinkMovementMethod.getInstance()
            }
        },
        update = { textView ->
            val spanned = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                android.text.Html.fromHtml(htmlContent, android.text.Html.FROM_HTML_MODE_LEGACY)
            } else {
                @Suppress("DEPRECATION")
                android.text.Html.fromHtml(htmlContent)
            }
            textView.text = spanned
        }
    )
}

@Composable
private fun RenderLegacyFormat(
    text: String,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    // Split by <hr> tags first
    val hrParts = text.split(Regex("<hr\\s*/?>", RegexOption.IGNORE_CASE))

    Column(modifier = modifier.fillMaxWidth()) {
        hrParts.forEachIndexed { hrIndex, hrPart ->
            if (hrIndex > 0) {
                // Add horizontal divider
                Spacer(modifier = Modifier.height(12.dp))
                androidx.compose.material3.HorizontalDivider(
                    thickness = 2.dp,
                    color = Color(0xFFE5E7EB)
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Split by <br> tags
            val brParts = hrPart.split(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE))

            brParts.forEachIndexed { brIndex, brPart ->
                if (brIndex > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                }

                // Parse **bold** text
                if (brPart.trim().isNotEmpty()) {
                    RenderBoldText(brPart.trim(), textColor)
                }
            }
        }
    }
}

@Composable
private fun RenderBoldText(
    text: String,
    textColor: Color
) {
    // Split by **bold** pattern (matching web implementation)
    // The pattern in parentheses creates a capturing group, so matches are included in results
    val boldPattern = Regex("(\\*\\*.+?\\*\\*)")
    val parts = text.split(boldPattern)

    Text(
        text = buildAnnotatedString {
            parts.forEach { part ->
                when {
                    part.startsWith("**") && part.endsWith("**") && part.length > 4 -> {
                        // Bold text - remove the ** markers
                        withStyle(style = SpanStyle(fontWeight = FontWeight.SemiBold)) {
                            append(part.substring(2, part.length - 2))
                        }
                    }
                    part.isNotEmpty() -> {
                        // Regular text
                        append(part)
                    }
                }
            }
        },
        fontSize = 15.sp,
        color = textColor,
        lineHeight = 23.sp
    )
}

private fun Color.toArgb(): Int {
    return android.graphics.Color.argb(
        (alpha * 255).toInt(),
        (red * 255).toInt(),
        (green * 255).toInt(),
        (blue * 255).toInt()
    )
}

/**
 * Extracts the video ID from various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
private fun extractYouTubeVideoId(url: String): String? {
    val patterns = listOf(
        "(?:youtube\\.com/watch\\?v=|youtu\\.be/|youtube\\.com/embed/)([a-zA-Z0-9_-]{11})".toRegex(),
        "^([a-zA-Z0-9_-]{11})$".toRegex() // Direct video ID
    )

    for (pattern in patterns) {
        val match = pattern.find(url)
        if (match != null) {
            return match.groupValues.getOrNull(1)
        }
    }
    return null
}
