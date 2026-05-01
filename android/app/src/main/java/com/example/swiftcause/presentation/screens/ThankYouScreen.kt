package com.example.swiftcause.presentation.screens

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swiftcause.BuildConfig
import com.example.swiftcause.R
import com.example.swiftcause.ThankYouData
import com.example.swiftcause.ui.theme.PremiumBorder
import com.example.swiftcause.ui.theme.PremiumBody
import com.example.swiftcause.ui.theme.PremiumCardSurface
import com.example.swiftcause.ui.theme.PremiumHeadline
import com.example.swiftcause.ui.theme.PremiumPageBackground
import com.example.swiftcause.ui.theme.PremiumPrimary
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.delay

private const val DISMISS_DELAY_WITH_QR = 30000L
private const val PROCESSING_ANIMATION_DELAY_MS = 1400L

private enum class ThankYouPhase {
    Processing,
    Complete
}

@Composable
fun ThankYouScreen(
    thankYouData: ThankYouData,
    customThankYouMessage: String? = null,
    accentColorHex: String? = null,
    magicLinkToken: String?,
    onDismiss: () -> Unit
) {
    var phase by remember { mutableStateOf(ThankYouPhase.Processing) }
    val totalSeconds = (DISMISS_DELAY_WITH_QR / 1000).toInt()
    var secondsRemaining by remember { mutableIntStateOf(totalSeconds) }
    val hasQr = !magicLinkToken.isNullOrBlank()
    val resolvedThankYouMessage = remember(customThankYouMessage) {
        customThankYouMessage?.trim()?.takeIf { it.isNotEmpty() }
    }
    val accentColor = remember(accentColorHex) {
        parseAccentColorOrNull(accentColorHex)
    } ?: PremiumPrimary

    val progress by animateFloatAsState(
        targetValue = if (hasQr) secondsRemaining.toFloat() / totalSeconds.toFloat() else 1f,
        animationSpec = tween(durationMillis = 1000, easing = LinearEasing),
        label = "resetProgress"
    )

    LaunchedEffect(Unit) {
        delay(PROCESSING_ANIMATION_DELAY_MS)
        phase = ThankYouPhase.Complete
    }

    LaunchedEffect(phase, magicLinkToken) {
        if (phase != ThankYouPhase.Complete) return@LaunchedEffect
        if (magicLinkToken.isNullOrBlank()) return@LaunchedEffect
        secondsRemaining = totalSeconds
        while (secondsRemaining > 0) {
            delay(1000)
            secondsRemaining--
        }
        onDismiss()
    }

    val qrBitmap = remember(magicLinkToken) { generateQrCode(magicLinkToken) }
    val infiniteTransition = rememberInfiniteTransition(label = "qr-loading")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse-scale"
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse-alpha"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PremiumPageBackground)
            .padding(horizontal = 24.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Crossfade(targetState = phase, label = "thank-you-phase") { currentPhase ->
            when (currentPhase) {
                ThankYouPhase.Processing -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(56.dp),
                            color = accentColor,
                            strokeWidth = 5.dp
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Text(
                            text = stringResource(R.string.processing_your_payment),
                            color = PremiumHeadline,
                            fontSize = 26.sp,
                            lineHeight = 32.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = stringResource(R.string.please_wait),
                            color = PremiumBody,
                            fontSize = 16.sp
                        )
                    }
                }

                ThankYouPhase.Complete -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = accentColor,
                            modifier = Modifier.size(66.dp)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = stringResource(R.string.payment_complete),
                            color = PremiumHeadline,
                            fontSize = 34.sp,
                            lineHeight = 40.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = resolvedThankYouMessage
                                ?: stringResource(R.string.thank_you_for_your_donation_plain),
                            color = PremiumBody,
                            fontSize = 17.sp,
                            textAlign = TextAlign.Center,
                            lineHeight = 24.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .widthIn(max = 560.dp)
                        )

                        Spacer(modifier = Modifier.height(18.dp))

                        Box(
                            modifier = Modifier
                                .size(290.dp)
                                .border(
                                    BorderStroke(
                                        width = if (hasQr) 2.dp else 3.dp,
                                        color = if (hasQr) PremiumBorder else accentColor.copy(alpha = pulseAlpha)
                                    ),
                                    shape = RoundedCornerShape(16.dp)
                                )
                                .background(PremiumCardSurface, RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            if (qrBitmap != null && hasQr) {
                                Image(
                                    bitmap = qrBitmap.asImageBitmap(),
                                    contentDescription = stringResource(R.string.qr_code_content_description),
                                    modifier = Modifier.size(242.dp)
                                )
                            } else {
                                Column(
                                    modifier = Modifier
                                        .align(Alignment.Center)
                                        .padding(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size((46 * pulseScale).dp),
                                        color = accentColor,
                                        strokeWidth = 4.dp
                                    )
                                    Spacer(modifier = Modifier.height(14.dp))
                                    Text(
                                        text = stringResource(R.string.generating_qr),
                                        color = PremiumBody,
                                        fontSize = 14.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = stringResource(R.string.scan_qr_for_gift_aid),
                            color = PremiumBody,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.widthIn(max = 520.dp)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = if (hasQr) {
                                stringResource(R.string.returning_to_campaigns_short, secondsRemaining)
                            } else {
                                stringResource(R.string.preparing_your_magic_link)
                            },
                            color = PremiumBody,
                            fontSize = 14.sp
                        )

                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp),
                            color = accentColor,
                            trackColor = PremiumBorder
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = onDismiss,
                            colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .height(52.dp)
                                .widthIn(min = 220.dp)
                        ) {
                            Text(
                                text = if (hasQr) {
                                    stringResource(R.string.ive_scanned_the_qr)
                                } else {
                                    stringResource(R.string.back_to_campaigns)
                                },
                                fontWeight = FontWeight.Bold
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

private fun generateQrCode(token: String?): Bitmap? {
    if (token.isNullOrBlank()) return null
    val fullUrl = "${BuildConfig.MAGIC_LINK_BASE_URL}/link/$token"
    return try {
        val writer = QRCodeWriter()
        val hints = mapOf(EncodeHintType.MARGIN to 1)
        val bitMatrix = writer.encode(fullUrl, BarcodeFormat.QR_CODE, 512, 512, hints)
        val bitmap = Bitmap.createBitmap(512, 512, Bitmap.Config.RGB_565)
        for (x in 0 until 512) {
            for (y in 0 until 512) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) AndroidColor.BLACK else AndroidColor.WHITE)
            }
        }
        bitmap
    } catch (_: Exception) {
        null
    }
}
