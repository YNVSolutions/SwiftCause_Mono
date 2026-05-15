package com.swiftcause.kiosk

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }
        container.addView(
            TextView(this).apply {
                gravity = Gravity.CENTER
                text = "SwiftCause Test Kiosk"
                textSize = 28f
            },
        )
        container.addView(
            TextView(this).apply {
                gravity = Gravity.CENTER
                text = "Installed and launched by the device controller."
                textSize = 16f
            },
        )
        setContentView(container)
    }
}
