package com.example.swiftcause.presentation.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KioskLoginLayoutTest {
    @Test
    fun compactWidthsUseSingleColumnWithConstrainedForm() {
        val spec = resolveKioskLoginLayout(maxWidthDp = 411)

        assertEquals(KioskLoginLayoutMode.Compact, spec.mode)
        assertFalse(spec.showIntroPanel)
        assertEquals(420, spec.contentMaxWidthDp)
        assertEquals(420, spec.formMaxWidthDp)
        assertEquals(24, spec.horizontalPaddingDp)
        assertEquals(56, spec.iconSizeDp)
    }

    @Test
    fun tabletWidthsUseTwoColumnLayoutWithReadableFormWidth() {
        val spec = resolveKioskLoginLayout(maxWidthDp = 900)

        assertEquals(KioskLoginLayoutMode.Tablet, spec.mode)
        assertTrue(spec.showIntroPanel)
        assertEquals(960, spec.contentMaxWidthDp)
        assertEquals(440, spec.formMaxWidthDp)
        assertEquals(48, spec.horizontalPaddingDp)
        assertEquals(72, spec.iconSizeDp)
    }

    @Test
    fun veryWideTabletsDoNotOverstretchTheLoginSurface() {
        val spec = resolveKioskLoginLayout(maxWidthDp = 1366)

        assertEquals(KioskLoginLayoutMode.Tablet, spec.mode)
        assertEquals(1040, spec.contentMaxWidthDp)
        assertEquals(440, spec.formMaxWidthDp)
    }
}
