package com.example.swiftcause.presentation.screens

enum class KioskLoginLayoutMode {
    Compact,
    Tablet,
}

data class KioskLoginLayoutSpec(
    val mode: KioskLoginLayoutMode,
    val showIntroPanel: Boolean,
    val contentMaxWidthDp: Int,
    val formMaxWidthDp: Int,
    val horizontalPaddingDp: Int,
    val verticalPaddingDp: Int,
    val iconSizeDp: Int,
    val contentGapDp: Int,
)

fun resolveKioskLoginLayout(maxWidthDp: Int): KioskLoginLayoutSpec {
    val isTablet = maxWidthDp >= 720
    return if (isTablet) {
        KioskLoginLayoutSpec(
            mode = KioskLoginLayoutMode.Tablet,
            showIntroPanel = maxWidthDp >= 840,
            contentMaxWidthDp = if (maxWidthDp >= 1200) 1040 else 960,
            formMaxWidthDp = 440,
            horizontalPaddingDp = 48,
            verticalPaddingDp = 40,
            iconSizeDp = 72,
            contentGapDp = 56,
        )
    } else {
        KioskLoginLayoutSpec(
            mode = KioskLoginLayoutMode.Compact,
            showIntroPanel = false,
            contentMaxWidthDp = 420,
            formMaxWidthDp = 420,
            horizontalPaddingDp = 24,
            verticalPaddingDp = 24,
            iconSizeDp = 56,
            contentGapDp = 32,
        )
    }
}
