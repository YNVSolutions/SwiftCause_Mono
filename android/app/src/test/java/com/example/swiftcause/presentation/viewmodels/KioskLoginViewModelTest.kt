package com.example.swiftcause.presentation.viewmodels

import com.example.swiftcause.domain.models.DisplayMode
import com.example.swiftcause.domain.models.KioskSession
import com.example.swiftcause.domain.models.KioskSettings
import com.example.swiftcause.domain.repositories.KioskAuthenticator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class KioskLoginViewModelTest {
    @get:Rule
    val mainDispatcherRule: MainDispatcherRule = MainDispatcherRule()

    private val messages = KioskLoginMessages(
        requiredFields = "Please enter both fields",
        authFailed = "Authentication failed",
        unexpected = { "Unexpected error: $it" },
    )

    @Test
    fun loginRejectsBlankFieldsWithoutCallingAuthenticator() = runTest {
        val authenticator = FakeKioskAuthenticator()
        val viewModel = KioskLoginViewModel(authenticator, messages)

        viewModel.updateKioskId("kiosk-1")
        viewModel.login()
        advanceUntilIdle()

        assertEquals("Please enter both fields", viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.isLoading)
        assertEquals(emptyList<FakeKioskAuthenticator.Attempt>(), authenticator.attempts)
    }

    @Test
    fun loginTrimsCredentialsAndPublishesAuthenticatedSession() = runTest {
        val session = kioskSession()
        val authenticator = FakeKioskAuthenticator(Result.success(session))
        val viewModel = KioskLoginViewModel(authenticator, messages)

        viewModel.updateKioskId("  kiosk-1  ")
        viewModel.updateAccessCode("  123456  ")
        viewModel.login()
        advanceUntilIdle()

        assertEquals(listOf(FakeKioskAuthenticator.Attempt("kiosk-1", "123456")), authenticator.attempts)
        assertTrue(viewModel.uiState.value.isAuthenticated)
        assertSame(session, viewModel.uiState.value.kioskSession)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun loginFailureKeepsEnteredValuesAndShowsError() = runTest {
        val authenticator = FakeKioskAuthenticator(Result.failure(Exception("Invalid kiosk credentials")))
        val viewModel = KioskLoginViewModel(authenticator, messages)

        viewModel.updateKioskId("kiosk-1")
        viewModel.updateAccessCode("bad-code")
        viewModel.login()
        advanceUntilIdle()

        assertEquals("kiosk-1", viewModel.uiState.value.kioskId)
        assertEquals("bad-code", viewModel.uiState.value.accessCode)
        assertEquals("Invalid kiosk credentials", viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.isAuthenticated)
        assertFalse(viewModel.uiState.value.isLoading)
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(
    private val dispatcher: TestDispatcher = StandardTestDispatcher(),
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}

private class FakeKioskAuthenticator(
    var nextResult: Result<KioskSession> = Result.success(kioskSession()),
) : KioskAuthenticator {
    data class Attempt(val kioskId: String, val accessCode: String)

    val attempts = mutableListOf<Attempt>()
    var signedOut = false

    override suspend fun authenticateKiosk(kioskId: String, accessCode: String): Result<KioskSession> {
        attempts += Attempt(kioskId, accessCode)
        return nextResult
    }

    override fun signOut() {
        signedOut = true
    }
}

private fun kioskSession() = KioskSession(
    kioskId = "kiosk-1",
    kioskName = "Main Entrance",
    organizationId = "org-1",
    assignedCampaigns = listOf("campaign-1"),
    settings = KioskSettings(
        displayMode = DisplayMode.GRID,
        showAllCampaigns = false,
        maxCampaignsDisplay = 6,
        autoRotateCampaigns = false,
    ),
    startTime = "2026-05-14T00:00:00Z",
)
