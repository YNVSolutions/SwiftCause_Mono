package com.example.swiftcause.presentation.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.swiftcause.data.api.RetrofitClient
import com.example.swiftcause.data.repository.KioskRepository
import com.example.swiftcause.domain.models.KioskSession
import com.example.swiftcause.domain.repositories.KioskAuthenticator
import com.example.swiftcause.utils.FirebaseManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class KioskLoginUiState(
    val kioskId: String = "",
    val accessCode: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val kioskSession: KioskSession? = null,
    val isAuthenticated: Boolean = false
)

data class KioskLoginMessages(
    val requiredFields: String,
    val authFailed: String,
    val unexpected: (String) -> String,
)

class KioskLoginViewModel(
    private val authenticator: KioskAuthenticator,
    private val messages: KioskLoginMessages,
) : ViewModel() {

    private val _uiState = MutableStateFlow(KioskLoginUiState())
    val uiState: StateFlow<KioskLoginUiState> = _uiState.asStateFlow()
    
    fun updateKioskId(kioskId: String) {
        _uiState.value = _uiState.value.copy(
            kioskId = kioskId,
            error = null
        )
    }
    
    fun updateAccessCode(accessCode: String) {
        _uiState.value = _uiState.value.copy(
            accessCode = accessCode,
            error = null
        )
    }
    
    fun login() {
        val currentState = _uiState.value
        
        if (currentState.kioskId.isBlank() || currentState.accessCode.isBlank()) {
            _uiState.value = currentState.copy(
                error = messages.requiredFields
            )
            return
        }
        
        viewModelScope.launch {
            try {
                _uiState.value = currentState.copy(isLoading = true, error = null)
                
                val result = authenticator.authenticateKiosk(
                    kioskId = currentState.kioskId.trim(),
                    accessCode = currentState.accessCode.trim()
                )
                
                result.fold(
                    onSuccess = { kioskSession ->
                        _uiState.value = KioskLoginUiState(
                            kioskSession = kioskSession,
                            isAuthenticated = true,
                            isLoading = false
                        )
                    },
                    onFailure = { exception ->
                        _uiState.value = currentState.copy(
                            isLoading = false,
                            error = exception.message
                                ?: messages.authFailed
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = currentState.copy(
                    isLoading = false,
                    error = messages.unexpected(e.message ?: messages.authFailed)
                )
            }
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
    
    fun signOut() {
        authenticator.signOut()
        _uiState.value = KioskLoginUiState()
    }

    companion object {
        fun factory(messages: KioskLoginMessages): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    if (modelClass.isAssignableFrom(KioskLoginViewModel::class.java)) {
                        return KioskLoginViewModel(
                            authenticator = KioskRepository(
                                apiService = RetrofitClient.kioskApiService,
                                firebaseAuth = FirebaseManager.auth,
                            ),
                            messages = messages,
                        ) as T
                    }
                    throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
                }
            }
    }
}
