package com.example.swiftcause.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import com.example.swiftcause.R
import com.example.swiftcause.domain.models.Campaign
import com.example.swiftcause.ui.components.SkeletonBox
import com.example.swiftcause.ui.theme.*
import com.example.swiftcause.utils.CurrencyFormatter

@Composable
fun CampaignCard(
    campaign: Campaign,
    onCardClick: () -> Unit = {},
    onAmountClick: (Long) -> Unit = {},
    onDonateClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val progress = campaign.getProgressPercentage()
    val top3Amounts = campaign.getTop3Amounts()
    
    Card(
        modifier = modifier
            .width(380.dp)
            .height(470.dp)
            .clickable(onClick = onCardClick),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(
            containerColor = CardBackground
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 8.dp,
            pressedElevation = 12.dp
        )
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Hero Cover Image
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(245.dp)
                    .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
            ) {
                SubcomposeAsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(campaign.coverImageUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = stringResource(
                        R.string.content_description_campaign_image,
                        campaign.title
                    ),
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                ) {
                    val state = painter.state
                    if (state is AsyncImagePainter.State.Loading || state is AsyncImagePainter.State.Empty) {
                        SkeletonBox(
                            modifier = Modifier.fillMaxSize(),
                            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
                        )
                    } else {
                        SubcomposeAsyncImageContent()
                    }
                }
            }
            
            // Campaign Info
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(225.dp)
                    .padding(16.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Campaign Title
                Text(
                    text = campaign.title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 22.sp,
                    modifier = Modifier.height(48.dp)
                )
                
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Progress Info Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = CurrencyFormatter.formatCurrency(
                                campaign.raised,
                                campaign.currency
                            ),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextPrimary
                        )
                        Text(
                            text = stringResource(
                                R.string.goal_amount,
                                CurrencyFormatter.formatCurrencyFromMajor(
                                    campaign.goal,
                                    campaign.currency
                                )
                            ),
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                        Text(
                            text = "${progress.toInt()}%",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextSuccess
                        )
                    }
                    
                    // Progress Bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ProgressBarBackground)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(progress / 100f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(PrimaryGreen)
                        )
                    }
                    
                    // Top 3 Amount Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        top3Amounts.forEach { amount ->
                            val formattedAmount = CurrencyFormatter.formatCurrencyFromMajor(
                                amount,
                                campaign.currency
                            )
                            OutlinedButton(
                                onClick = { onAmountClick(amount) },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(40.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    containerColor = ButtonGray,
                                    contentColor = PrimaryGreen
                                ),
                                border = ButtonDefaults.outlinedButtonBorder.copy(
                                    width = 1.dp,
                                    brush = androidx.compose.ui.graphics.SolidColor(BorderGray)
                                )
                            ) {
                                Text(
                                    text = formattedAmount,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                    
                    // Donate Button
                    Button(
                        onClick = onDonateClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PrimaryGreen,
                            contentColor = Color.White
                        ),
                        elevation = ButtonDefaults.buttonElevation(
                            defaultElevation = 2.dp
                        )
                    ) {
                        Text(
                            text = stringResource(R.string.donate),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
