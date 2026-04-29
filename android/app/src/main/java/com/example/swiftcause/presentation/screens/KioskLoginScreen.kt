package com.example.swiftcause.presentation.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.swiftcause.R
import com.example.swiftcause.domain.models.KioskSession
import com.example.swiftcause.presentation.viewmodels.KioskLoginViewModel

@Composable
fun KioskLoginScreen(
    viewModel: KioskLoginViewModel = viewModel(),
    onLoginSuccess: (KioskSession) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(uiState.isAuthenticated, uiState.kioskSession) {
        if (uiState.isAuthenticated && uiState.kioskSession != null) {
            onLoginSuccess(uiState.kioskSession!!)
        }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            if (uiState.isAuthenticated && uiState.kioskSession != null) {
                // Avoid flashing an intermediate "Continue" screen before navigation
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator()
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = stringResource(R.string.kiosk_signing_in),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                // Login Form
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    // Logo/Title
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = stringResource(R.string.kiosk_id_label),
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = stringResource(R.string.kiosk_title),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = stringResource(R.string.kiosk_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(32.dp))

                    // Kiosk ID Field
                    OutlinedTextField(
                        value = uiState.kioskId,
                        onValueChange = { viewModel.updateKioskId(it) },
                        label = { Text(stringResource(R.string.kiosk_id_label)) },
                        placeholder = { Text(stringResource(R.string.kiosk_id_placeholder)) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = stringResource(R.string.kiosk_id_label)
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !uiState.isLoading,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Text,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        )
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Access Code Field
                    OutlinedTextField(
                        value = uiState.accessCode,
                        onValueChange = { viewModel.updateAccessCode(it) },
                        label = { Text(stringResource(R.string.access_code_label)) },
                        placeholder = { Text(stringResource(R.string.access_code_placeholder)) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = stringResource(R.string.access_code_label)
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !uiState.isLoading,
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.login()
                            }
                        )
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Error Message
                    if (uiState.error != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            )
                        ) {
                            Text(
                                text = uiState.error ?: "",
                                modifier = Modifier.padding(16.dp),
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }

                    // Login Button
                    Button(
                        onClick = { viewModel.login() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = !uiState.isLoading
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.sign_in),
                                style = MaterialTheme.typography.titleMedium
                            )
                        }
                    }

                }
            }
        }
    }
}

@Composable
fun KioskSuccessScreen(
    kioskName: String,
    onContinue: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(

            imageVector = Icons.Default.LocationOn,
            contentDescription = stringResource(R.string.success_content_description),
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = stringResource(R.string.welcome),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = kioskName,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = onContinue,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Text(
                text = stringResource(R.string.continue_action),
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}
