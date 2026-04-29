package com.example.swiftcause.presentation.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.swiftcause.R
import com.example.swiftcause.data.api.RetrofitClient
import com.example.swiftcause.data.repository.KioskRepository
import com.example.swiftcause.domain.models.KioskSession
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

class KioskLoginViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = KioskRepository(
        apiService = RetrofitClient.kioskApiService,
        firebaseAuth = FirebaseManager.auth
    )
    
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
                error = getApplication<Application>().getString(R.string.kiosk_login_error_required_fields)
            )
            return
        }
        
        viewModelScope.launch {
            try {
                _uiState.value = currentState.copy(isLoading = true, error = null)
                
                val result = repository.authenticateKiosk(
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
                                ?: getApplication<Application>().getString(R.string.kiosk_login_error_auth_failed)
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = currentState.copy(
                    isLoading = false,
                    error = getApplication<Application>().getString(
                        R.string.kiosk_login_error_unexpected,
                        e.message ?: getApplication<Application>().getString(R.string.error_generic)
                    )
                )
            }
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
    
    fun signOut() {
        repository.signOut()
        _uiState.value = KioskLoginUiState()
    }
}
