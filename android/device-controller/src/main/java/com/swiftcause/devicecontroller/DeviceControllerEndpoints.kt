package com.swiftcause.devicecontroller

object DeviceControllerEndpoints {
    val safeCommands = setOf("sync_policy", "restart_kiosk", "refresh_content", "clear_error")

    fun normalizeBaseUrl(baseUrl: String): String = baseUrl.trim().trimEnd('/')

    fun register(baseUrl: String): String = "${normalizeBaseUrl(baseUrl)}/kioskDeviceRegister"

    fun policy(baseUrl: String, deviceId: String): String =
        "${normalizeBaseUrl(baseUrl)}/kioskDevicePolicy?deviceId=${urlEncode(deviceId)}"

    fun apkDownload(baseUrl: String, deviceId: String, apkId: String): String =
        "${normalizeBaseUrl(baseUrl)}/kioskApkDownload?deviceId=${urlEncode(deviceId)}&apkId=${urlEncode(apkId)}"

    fun status(baseUrl: String): String = "${normalizeBaseUrl(baseUrl)}/kioskDeviceStatus"

    fun heartbeat(baseUrl: String): String = "${normalizeBaseUrl(baseUrl)}/kioskDeviceHeartbeat"

    fun commands(baseUrl: String, deviceId: String): String =
        "${normalizeBaseUrl(baseUrl)}/kioskDeviceCommands?deviceId=${urlEncode(deviceId)}"

    fun commandResult(baseUrl: String): String =
        "${normalizeBaseUrl(baseUrl)}/kioskDeviceCommandResult"

    fun isSupportedCommand(commandType: String): Boolean = safeCommands.contains(commandType)

    private fun urlEncode(value: String): String =
        java.net.URLEncoder.encode(value, "UTF-8")
}
