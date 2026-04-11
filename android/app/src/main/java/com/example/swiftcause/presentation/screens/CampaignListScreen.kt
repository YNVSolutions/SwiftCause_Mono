package com.example.swiftcause.presentation.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.imageLoader
import coil.size.Size
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
    onCampaignClick: (Campaign) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    // Prefetch cover images into shared Coil memory/disk cache once campaigns are loaded.
    LaunchedEffect(campaigns.map { it.id to it.coverImageUrl }) {
        val imageLoader = context.imageLoader
        campaigns.forEach { campaign ->
            campaign.coverImageUrl?.takeIf { it.isNotBlank() }?.let { imageUrl ->
                val request = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .size(Size.ORIGINAL)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .build()
                imageLoader.enqueue(request)
            }
        }
    }

    Scaffold(
        modifier = modifier,
        containerColor = BackgroundGray,
        topBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp), // Further reduced vertical padding
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp) // Further reduced spacing
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_swiftcause_logo),
                        contentDescription = "SwiftCause Logo",
                        modifier = Modifier.size(24.dp), // Further reduced logo size
                        colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.primary)
                    )
                    Text(
                        text = "SwiftCause",
                        style = MaterialTheme.typography.headlineSmall.copy( // Further reduced text size
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
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
                            color = MaterialTheme.colorScheme.primary
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
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp), // Reduced horizontal padding
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        items(campaigns) { campaign ->
                            CampaignRow(
                                campaign = campaign,
                                onCampaignClick = { onCampaignClick(campaign) }
                            )
                        }
                    }
                }
            }
        }
    }
}
