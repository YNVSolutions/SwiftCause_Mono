package com.example.swiftcause.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryGreen,
    secondary = AccentGreen,
    tertiary = ProgressGreen,
    background = Color(0xFF0A0A0A),
    surface = DarkGreen,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color.White,
    onSurface = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = PremiumPrimary,
    secondary = PremiumPrimaryPressed,
    tertiary = ProgressGreen,
    background = PremiumPageBackground,
    surface = PremiumPanelSurface,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = PremiumHeadline,
    onSurface = PremiumHeadline
)

@Composable
fun SwiftCauseTheme(
    darkTheme: Boolean = false,
    // Dynamic color disabled to use brand colors
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
