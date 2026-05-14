package com.swiftcause.devicecontroller

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceControllerEndpointsTest {
    @Test
    fun buildsFunctionUrlsFromBaseUrl() {
        val baseUrl = "http://10.0.2.2:5001/swiftcause-app/us-central1/"

        assertEquals(
            "http://10.0.2.2:5001/swiftcause-app/us-central1/kioskDeviceRegister",
            DeviceControllerEndpoints.register(baseUrl),
        )
        assertEquals(
            "http://10.0.2.2:5001/swiftcause-app/us-central1/kioskDevicePolicy?deviceId=device_123",
            DeviceControllerEndpoints.policy(baseUrl, "device_123"),
        )
        assertEquals(
            "http://10.0.2.2:5001/swiftcause-app/us-central1/kioskApkDownload?deviceId=device_123&apkId=apk+1",
            DeviceControllerEndpoints.apkDownload(baseUrl, "device_123", "apk 1"),
        )
    }

    @Test
    fun identifiesSafeCommands() {
        assertTrue(DeviceControllerEndpoints.isSupportedCommand("sync_policy"))
        assertTrue(DeviceControllerEndpoints.isSupportedCommand("restart_kiosk"))
        assertTrue(DeviceControllerEndpoints.isSupportedCommand("refresh_content"))
        assertTrue(DeviceControllerEndpoints.isSupportedCommand("clear_error"))
        assertFalse(DeviceControllerEndpoints.isSupportedCommand("factory_reset"))
    }
}
