package com.example.swiftcause.presentation.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.example.swiftcause.R
import com.example.swiftcause.domain.models.Campaign
import com.example.swiftcause.presentation.components.CampaignRow
import com.example.swiftcause.ui.theme.BackgroundGray
import com.example.swiftcause.ui.theme.TextPrimary

@Composable
fun CampaignListScreen(
    campaigns: List<Campaign>,
    isLoading: Boolean = false,
    organizationDisplayName: String? = null,
    organizationLogoUrl: String? = null,
    accentColorHex: String? = null,
    onCampaignClick: (Campaign) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val refreshingInBackground = isLoading && campaigns.isNotEmpty()
    val prefetchedCoverUrls = remember { mutableSetOf<String>() }
    val coverPrefetchSizePx = remember(density) {
        with(density) {
            // CampaignRow cover image is rendered around 150dp x 120dp.
            150.dp.roundToPx() to 120.dp.roundToPx()
        }
    }
    val uniqueCoverUrls = remember(campaigns) {
        campaigns
            .asSequence()
            .mapNotNull { it.coverImageUrl?.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .sorted()
            .toList()
    }
    val logoTransition = rememberInfiniteTransition(label = "logo-refresh")
    val logoPulseScale = if (refreshingInBackground) {
        logoTransition.animateFloat(
            initialValue = 1f,
            targetValue = 1.06f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 900, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "logo-scale"
        ).value
    } else 1f
    val logoPulseAlpha = if (refreshingInBackground) {
        logoTransition.animateFloat(
            initialValue = 0.85f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 900, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "logo-alpha"
        ).value
    } else 1f
    val accentColor = remember(accentColorHex) {
        parseAccentColorOrNull(accentColorHex)
    } ?: MaterialTheme.colorScheme.primary

    // Prefetch cover images into shared Coil memory/disk cache once campaigns are loaded.
    LaunchedEffect(uniqueCoverUrls, coverPrefetchSizePx) {
        val imageLoader = context.imageLoader
        val (prefetchWidthPx, prefetchHeightPx) = coverPrefetchSizePx

        uniqueCoverUrls
            .filter { imageUrl -> prefetchedCoverUrls.add(imageUrl) }
            .forEach { imageUrl ->
                val request = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .size(prefetchWidthPx, prefetchHeightPx)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .build()
                imageLoader.enqueue(request)
            }
        }

    Scaffold(
        modifier = modifier,
        containerColor = BackgroundGray,
        topBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val normalizedLogoUrl = organizationLogoUrl?.trim().orEmpty()
                    if (normalizedLogoUrl.isNotEmpty()) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(normalizedLogoUrl)
                                .crossfade(true)
                                .build(),
                            contentDescription = stringResource(R.string.organization_logo_content_description),
                            contentScale = ContentScale.Crop,
                            error = painterResource(id = R.drawable.ic_swiftcause_logo),
                            placeholder = painterResource(id = R.drawable.ic_swiftcause_logo),
                            modifier = Modifier
                                .size(24.dp)
                                .clip(MaterialTheme.shapes.small)
                                .scale(logoPulseScale)
                                .alpha(logoPulseAlpha)
                        )
                    } else {
                        Image(
                            painter = painterResource(id = R.drawable.ic_swiftcause_logo),
                            contentDescription = stringResource(R.string.organization_logo_content_description),
                            modifier = Modifier
                                .size(24.dp)
                                .scale(logoPulseScale)
                                .alpha(logoPulseAlpha),
                            colorFilter = ColorFilter.tint(accentColor)
                        )
                    }
                    Text(
                        text = organizationDisplayName?.takeIf { it.isNotBlank() }
                            ?: stringResource(R.string.app_name),
                        style = MaterialTheme.typography.headlineSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = accentColor
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                isLoading && campaigns.isEmpty() -> { // Show loading only when the list is empty initially
                    // Loading State
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = accentColor
                        )
                    }
                }

                campaigns.isEmpty() -> {
                    // Empty State
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stringResource(R.string.campaign_list_empty),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextPrimary.copy(alpha = 0.6f)
                        )
                    }
                }

                else -> {
                    // Campaign List
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        items(campaigns) { campaign ->
                            CampaignRow(
                                campaign = campaign,
                                accentColor = accentColor,
                                onCampaignClick = { onCampaignClick(campaign) }
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun parseAccentColorOrNull(hex: String?): Color? {
    val value = hex?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return try {
        Color(android.graphics.Color.parseColor(value))
    } catch (_: IllegalArgumentException) {
        null
    }
}
