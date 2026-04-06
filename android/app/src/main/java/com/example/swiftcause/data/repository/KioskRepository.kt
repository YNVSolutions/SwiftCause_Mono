package com.example.swiftcause.data.repository

import com.example.swiftcause.data.api.KioskApiService
import com.example.swiftcause.data.models.KioskLoginRequest
import com.example.swiftcause.data.models.toDomainModel
import com.example.swiftcause.domain.models.KioskSession
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

class KioskRepository(
    private val apiService: KioskApiService,
    private val firebaseAuth: FirebaseAuth
) {
    suspend fun authenticateKiosk(kioskId: String, accessCode: String): Result<KioskSession> {
        return try {
            val response = apiService.kioskLogin(
                KioskLoginRequest(kioskId, accessCode)
            )
            
            if (!response.isSuccessful) {
                val errorBody = response.errorBody()?.string()
                val errorMsg = errorBody ?: "Authentication failed"
                return Result.failure(Exception(errorMsg))
            }
            
            val loginResponse = response.body()
            
            if (loginResponse == null || !loginResponse.success) {
                val error = loginResponse?.error ?: "Invalid credentials"
                return Result.failure(Exception(error))
            }
            
            val token = loginResponse.token
            val kioskData = loginResponse.kioskData
            
            if (token == null || kioskData == null) {
                return Result.failure(Exception("Missing authentication data"))
            }
            
            // Sign in with Firebase custom token
            try {
                firebaseAuth.signInWithCustomToken(token).await()
            } catch (e: Exception) {
                return Result.failure(Exception("Firebase authentication failed: ${e.message}"))
            }
            
            // Convert to domain model
            val kioskSession = kioskData.toDomainModel()
            
            Result.success(kioskSession)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun signOut() {
        firebaseAuth.signOut()
    }
}
