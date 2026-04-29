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
                return Result.failure(Exception(errorBody))
            }
            
            val loginResponse = response.body()
            
            if (loginResponse == null || !loginResponse.success) {
                return Result.failure(Exception(loginResponse?.error))
            }
            
            val token = loginResponse.token
            val kioskData = loginResponse.kioskData
            
            if (token == null || kioskData == null) {
                return Result.failure(IllegalStateException())
            }
            
            // Sign in with Firebase custom token
            try {
                firebaseAuth.signInWithCustomToken(token).await()
            } catch (e: Exception) {
                return Result.failure(e)
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
