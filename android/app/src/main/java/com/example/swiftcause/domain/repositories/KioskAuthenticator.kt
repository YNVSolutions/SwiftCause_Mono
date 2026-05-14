package com.example.swiftcause.domain.repositories

import com.example.swiftcause.domain.models.KioskSession

interface KioskAuthenticator {
    suspend fun authenticateKiosk(kioskId: String, accessCode: String): Result<KioskSession>

    fun signOut()
}
