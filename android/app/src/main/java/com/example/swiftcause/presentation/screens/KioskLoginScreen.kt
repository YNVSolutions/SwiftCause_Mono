package com.example.swiftcause.presentation.screens

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusManager
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
import com.example.swiftcause.presentation.viewmodels.KioskLoginMessages
import com.example.swiftcause.presentation.viewmodels.KioskLoginUiState
import com.example.swiftcause.presentation.viewmodels.KioskLoginViewModel
import kotlin.math.roundToInt

@Composable
fun KioskLoginScreen(
    viewModel: KioskLoginViewModel = rememberKioskLoginViewModel(),
    onLoginSuccess: (KioskSession) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(uiState.isAuthenticated, uiState.kioskSession) {
        if (uiState.isAuthenticated && uiState.kioskSession != null) {
            onLoginSuccess(uiState.kioskSession!!)
        }
    }

    KioskLoginContent(
        uiState = uiState,
        focusManager = focusManager,
        onKioskIdChange = viewModel::updateKioskId,
        onAccessCodeChange = viewModel::updateAccessCode,
        onLogin = viewModel::login,
    )
}

@Composable
private fun rememberKioskLoginViewModel(): KioskLoginViewModel {
    val requiredFields = stringResource(R.string.kiosk_login_error_required_fields)
    val authFailed = stringResource(R.string.kiosk_login_error_auth_failed)
    val genericError = stringResource(R.string.error_generic)
    val unexpectedTemplate = stringResource(R.string.kiosk_login_error_unexpected, "__MESSAGE__")
    val messages = remember(requiredFields, authFailed, genericError, unexpectedTemplate) {
        KioskLoginMessages(
            requiredFields = requiredFields,
            authFailed = authFailed,
            unexpected = { message ->
                unexpectedTemplate.replace("__MESSAGE__", message.ifBlank { genericError })
            },
        )
    }
    return viewModel(factory = KioskLoginViewModel.factory(messages))
}

@Composable
private fun KioskLoginContent(
    uiState: KioskLoginUiState,
    focusManager: FocusManager,
    onKioskIdChange: (String) -> Unit,
    onAccessCodeChange: (String) -> Unit,
    onLogin: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val layoutSpec = remember(maxWidth) {
                resolveKioskLoginLayout(maxWidth.value.roundToInt())
            }

            if (uiState.isAuthenticated && uiState.kioskSession != null) {
                KioskLoginProgress()
            } else if (layoutSpec.showIntroPanel) {
                Row(
                    modifier = Modifier
                        .widthIn(max = layoutSpec.contentMaxWidthDp.dp)
                        .fillMaxWidth()
                        .padding(
                            horizontal = layoutSpec.horizontalPaddingDp.dp,
                            vertical = layoutSpec.verticalPaddingDp.dp,
                        ),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    KioskLoginBranding(
                        layoutSpec = layoutSpec,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(modifier = Modifier.width(layoutSpec.contentGapDp.dp))
                    KioskLoginForm(
                        uiState = uiState,
                        focusManager = focusManager,
                        onKioskIdChange = onKioskIdChange,
                        onAccessCodeChange = onAccessCodeChange,
                        onLogin = onLogin,
                        modifier = Modifier.width(layoutSpec.formMaxWidthDp.dp),
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .widthIn(max = layoutSpec.contentMaxWidthDp.dp)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(
                            horizontal = layoutSpec.horizontalPaddingDp.dp,
                            vertical = layoutSpec.verticalPaddingDp.dp,
                        ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    KioskLoginBranding(layoutSpec = layoutSpec)
                    Spacer(modifier = Modifier.height(layoutSpec.contentGapDp.dp))
                    KioskLoginForm(
                        uiState = uiState,
                        focusManager = focusManager,
                        onKioskIdChange = onKioskIdChange,
                        onAccessCodeChange = onAccessCodeChange,
                        onLogin = onLogin,
                        modifier = Modifier
                            .widthIn(max = layoutSpec.formMaxWidthDp.dp)
                            .fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
private fun KioskLoginProgress() {
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
}

@Composable
private fun KioskLoginBranding(
    layoutSpec: KioskLoginLayoutSpec,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = stringResource(R.string.kiosk_id_label),
            modifier = Modifier.size(layoutSpec.iconSizeDp.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.kiosk_title),
            style = if (layoutSpec.mode == KioskLoginLayoutMode.Tablet) {
                MaterialTheme.typography.headlineLarge
            } else {
                MaterialTheme.typography.headlineMedium
            },
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.kiosk_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun KioskLoginForm(
    uiState: KioskLoginUiState,
    focusManager: FocusManager,
    onKioskIdChange: (String) -> Unit,
    onAccessCodeChange: (String) -> Unit,
    onLogin: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        OutlinedTextField(
            value = uiState.kioskId,
            onValueChange = onKioskIdChange,
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

        OutlinedTextField(
            value = uiState.accessCode,
            onValueChange = onAccessCodeChange,
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
                    onLogin()
                }
            )
        )

        Spacer(modifier = Modifier.height(24.dp))

        if (uiState.error != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Text(
                    text = uiState.error,
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = onLogin,
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
