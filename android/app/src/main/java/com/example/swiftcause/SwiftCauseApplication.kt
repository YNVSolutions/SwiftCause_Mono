package com.example.swiftcause

import android.app.Application
import com.stripe.stripeterminal.TerminalApplicationDelegate

/**
 * Application class for SwiftCause
 * Handles Stripe Terminal SDK initialization for Tap to Pay
 */
class SwiftCauseApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // Initialize Terminal SDK for lifecycle management
        TerminalApplicationDelegate.onCreate(this)
    }
}
