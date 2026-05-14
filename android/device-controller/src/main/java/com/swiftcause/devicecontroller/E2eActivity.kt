package com.swiftcause.devicecontroller

import android.Manifest
import android.app.Activity
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.TextView
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.io.PrintWriter
import java.io.StringWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class E2eActivity : Activity() {
    private lateinit var statusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        statusView = TextView(this).apply {
            gravity = Gravity.CENTER
            textSize = 18f
            setPadding(32, 32, 32, 32)
            text = "SwiftCause Device Controller"
        }
        setContentView(statusView)
        Thread { runE2eFlow() }.start()
    }

    private fun runE2eFlow() {
        try {
            val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
            val apiBaseUrl = DeviceControllerEndpoints.normalizeBaseUrl(
                readExtraOrPref(prefs, "apiBaseUrl", BuildConfig.DEFAULT_API_BASE_URL),
            )
            val enrollmentToken = readExtraOrPref(prefs, "enrollmentToken", "")
            require(enrollmentToken.isNotBlank()) { "Missing enrollmentToken extra" }
            prefs.edit()
                .putString("apiBaseUrl", apiBaseUrl)
                .putString("enrollmentToken", enrollmentToken)
                .apply()

            setStatus("Registering controller...")
            val registration = register(apiBaseUrl, enrollmentToken)
            val deviceId = registration.getString("deviceId")
            val deviceSecret = registration.getString("deviceSecret")
            prefs.edit()
                .putString("deviceId", deviceId)
                .putString("deviceSecret", deviceSecret)
                .apply()

            setStatus("Fetching policy...")
            val policy = fetchPolicy(apiBaseUrl, deviceId, deviceSecret)
            reportStatus(
                apiBaseUrl,
                deviceId,
                deviceSecret,
                "online",
                installStatus = "policy_fetched",
                deviceOwner = isDeviceOwner(),
            )

            val apkPolicy = policy.optJSONObject("apk")
            if (apkPolicy == null) {
                reportStatus(
                    apiBaseUrl,
                    deviceId,
                    deviceSecret,
                    "error",
                    error = "Policy did not include an APK",
                )
                sendHeartbeat(apiBaseUrl, deviceId, deviceSecret)
                return
            }

            val downloadMetadata = fetchApkDownload(
                apiBaseUrl,
                deviceId,
                deviceSecret,
                apkPolicy.getString("apkId"),
            )
            setStatus("Downloading kiosk APK...")
            reportStatus(apiBaseUrl, deviceId, deviceSecret, "installing", installStatus = "downloading")
            val apkFile = download(downloadMetadata.getString("downloadUrl"), "swiftcause-test-kiosk.apk")
            val expectedHash = downloadMetadata.optString("checksumSha256", "")
            if (expectedHash.isNotBlank()) {
                val actualHash = sha256(apkFile)
                require(expectedHash.equals(actualHash, ignoreCase = true)) {
                    "APK SHA-256 mismatch: $actualHash"
                }
            }

            val kioskPackage = downloadMetadata.getString("packageName")
            setStatus("Installing $kioskPackage...")
            val installed = installApk(apkFile, kioskPackage)
            if (installed) {
                configureKioskPackage(kioskPackage)
            }
            reportStatus(
                apiBaseUrl,
                deviceId,
                deviceSecret,
                if (installed) "online" else "install_failed",
                installStatus = if (installed) "installed" else "install_timeout",
                deviceOwner = isDeviceOwner(),
                error = if (installed) null else "PackageInstaller did not report installed package",
            )

            if (installed) {
                setStatus("Launching kiosk...")
                val launched = launchPackage(kioskPackage)
                reportStatus(
                    apiBaseUrl,
                    deviceId,
                    deviceSecret,
                    if (launched) "kiosk_active" else "error",
                    launchStatus = if (launched) "launched" else "launch_intent_missing",
                    deviceOwner = isDeviceOwner(),
                    error = if (launched) null else "Launch intent not found for $kioskPackage",
                )
            }

            setStatus("Polling commands...")
            executePendingCommands(apiBaseUrl, deviceId, deviceSecret, kioskPackage)
            sendHeartbeat(apiBaseUrl, deviceId, deviceSecret)
            setStatus("SwiftCause emulator E2E complete")
        } catch (error: Exception) {
            setStatus("SwiftCause E2E failed: ${error.message}")
            android.util.Log.e(TAG, "E2E failed", error)
            tryReportFailure(error)
        }
    }

    private fun register(apiBaseUrl: String, enrollmentToken: String): JSONObject {
        val body = JSONObject()
            .put("enrollmentToken", enrollmentToken)
            .put("androidId", Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID))
            .put("serialNumber", Build.SERIAL ?: "")
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("controllerVersion", BuildConfig.VERSION_NAME)
        return postJson(DeviceControllerEndpoints.register(apiBaseUrl), null, body)
    }

    private fun fetchPolicy(apiBaseUrl: String, deviceId: String, deviceSecret: String): JSONObject =
        getJson(DeviceControllerEndpoints.policy(apiBaseUrl, deviceId), deviceSecret)

    private fun fetchApkDownload(
        apiBaseUrl: String,
        deviceId: String,
        deviceSecret: String,
        apkId: String,
    ): JSONObject = getJson(DeviceControllerEndpoints.apkDownload(apiBaseUrl, deviceId, apkId), deviceSecret)

    private fun executePendingCommands(
        apiBaseUrl: String,
        deviceId: String,
        deviceSecret: String,
        kioskPackage: String,
    ) {
        val response = getJson(DeviceControllerEndpoints.commands(apiBaseUrl, deviceId), deviceSecret)
        val commands = response.optJSONArray("commands") ?: return
        for (index in 0 until commands.length()) {
            val command = commands.getJSONObject(index)
            val commandId = command.getString("id")
            val commandType = command.getString("commandType")
            try {
                require(DeviceControllerEndpoints.isSupportedCommand(commandType)) {
                    "Unsupported command: $commandType"
                }
                when (commandType) {
                    "sync_policy" -> fetchPolicy(apiBaseUrl, deviceId, deviceSecret)
                    "restart_kiosk" -> require(launchPackage(kioskPackage)) {
                        "Launch intent not found for $kioskPackage"
                    }
                    "refresh_content" -> Unit
                    "clear_error" -> reportStatus(
                        apiBaseUrl,
                        deviceId,
                        deviceSecret,
                        "online",
                        error = null,
                        clearError = true,
                    )
                }
                reportCommandResult(apiBaseUrl, deviceId, deviceSecret, commandId, "succeeded", "Executed")
            } catch (error: Exception) {
                reportCommandResult(
                    apiBaseUrl,
                    deviceId,
                    deviceSecret,
                    commandId,
                    "failed",
                    error.message ?: error.toString(),
                )
            }
        }
    }

    private fun reportStatus(
        apiBaseUrl: String,
        deviceId: String,
        deviceSecret: String,
        status: String,
        installStatus: String? = null,
        launchStatus: String? = null,
        deviceOwner: Boolean? = null,
        error: String? = null,
        clearError: Boolean = false,
    ) {
        val body = JSONObject()
            .put("deviceId", deviceId)
            .put("status", status)
        if (installStatus != null) body.put("installStatus", installStatus)
        if (launchStatus != null) body.put("launchStatus", launchStatus)
        if (deviceOwner != null) body.put("deviceOwner", deviceOwner)
        if (error != null) {
            body.put("error", error)
        } else if (status != "online" || clearError) {
            body.put("error", JSONObject.NULL)
        }
        postJson(DeviceControllerEndpoints.status(apiBaseUrl), deviceSecret, body)
    }

    private fun reportCommandResult(
        apiBaseUrl: String,
        deviceId: String,
        deviceSecret: String,
        commandId: String,
        status: String,
        message: String,
    ) {
        val body = JSONObject()
            .put("deviceId", deviceId)
            .put("commandId", commandId)
            .put("status", status)
            .put("message", message)
        postJson(DeviceControllerEndpoints.commandResult(apiBaseUrl), deviceSecret, body)
    }

    private fun sendHeartbeat(apiBaseUrl: String, deviceId: String, deviceSecret: String) {
        val body = JSONObject()
            .put("deviceId", deviceId)
            .put("networkType", "emulator")
        postJson(DeviceControllerEndpoints.heartbeat(apiBaseUrl), deviceSecret, body)
    }

    private fun installApk(file: File, packageName: String): Boolean {
        check(isDeviceOwner()) { "Device Owner is required for silent install" }
        val installer = packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            .apply { setAppPackageName(packageName) }
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        session.openWrite("swiftcause-kiosk", 0, file.length()).use { out ->
            BufferedInputStream(FileInputStream(file)).use { input ->
                input.copyTo(out, 64 * 1024)
            }
            out.flush()
            session.fsync(out)
        }
        val callback = Intent("com.swiftcause.devicecontroller.INSTALL_RESULT")
            .setPackage(this.packageName)
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            sessionId,
            callback,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
        session.commit(pendingIntent.intentSender)
        session.close()

        repeat(20) {
            Thread.sleep(1_000)
            if (isPackageInstalled(packageName)) return true
        }
        return false
    }

    private fun launchPackage(packageName: String): Boolean {
        configureKioskPackage(packageName)
        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return false
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launch)
        return true
    }

    private fun configureKioskPackage(packageName: String) {
        if (!isDeviceOwner()) return
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(this, DeviceAdminReceiver::class.java)
        dpm.setLockTaskPackages(admin, arrayOf(packageName, this.packageName))
        dpm.setKeyguardDisabled(admin, true)
        dpm.setStatusBarDisabled(admin, true)

        listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN,
        ).forEach { permission ->
            dpm.setPermissionGrantState(
                admin,
                packageName,
                permission,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
            )
        }
    }

    private fun isPackageInstalled(packageName: String): Boolean =
        try {
            packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }

    private fun isDeviceOwner(): Boolean {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isDeviceOwnerApp(packageName)
    }

    private fun getJson(url: String, bearer: String): JSONObject =
        JSONObject(read(open(url, "GET", bearer)))

    private fun postJson(url: String, bearer: String?, body: JSONObject): JSONObject {
        val connection = open(url, "POST", bearer)
        connection.setRequestProperty("Content-Type", "application/json")
        connection.doOutput = true
        connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        return JSONObject(read(connection))
    }

    private fun open(url: String, method: String, bearer: String?): HttpURLConnection {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        if (!bearer.isNullOrBlank()) {
            connection.setRequestProperty("Authorization", "Bearer $bearer")
        }
        return connection
    }

    private fun read(connection: HttpURLConnection): String {
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val response = ByteArrayOutputStream().use { out ->
            stream.use { input -> input.copyTo(out) }
            out.toString("UTF-8")
        }
        check(code in 200..299) { "HTTP $code: $response" }
        return response
    }

    private fun download(url: String, name: String): File {
        val connection = open(url, "GET", null)
        check(connection.responseCode in 200..299) { "Download failed HTTP ${connection.responseCode}" }
        val file = File(cacheDir, name)
        connection.inputStream.use { input ->
            FileOutputStream(file).use { output -> input.copyTo(output, 64 * 1024) }
        }
        return file
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun readExtraOrPref(prefs: SharedPreferences, key: String, defaultValue: String): String =
        intent.getStringExtra(key)?.takeIf { it.isNotBlank() } ?: prefs.getString(key, defaultValue).orEmpty()

    private fun tryReportFailure(error: Exception) {
        try {
            val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
                val apiBaseUrl = prefs.getString("apiBaseUrl", BuildConfig.DEFAULT_API_BASE_URL)
                    ?.let { DeviceControllerEndpoints.normalizeBaseUrl(it) }
            val deviceId = prefs.getString("deviceId", null)
            val deviceSecret = prefs.getString("deviceSecret", null)
            if (!apiBaseUrl.isNullOrBlank() && !deviceId.isNullOrBlank() && !deviceSecret.isNullOrBlank()) {
                reportStatus(
                    apiBaseUrl,
                    deviceId,
                    deviceSecret,
                    "error",
                    error = "${error.message}\n${stackTrace(error)}",
                    deviceOwner = isDeviceOwner(),
                )
            }
        } catch (_: Exception) {
        }
    }

    private fun stackTrace(error: Exception): String {
        val writer = StringWriter()
        error.printStackTrace(PrintWriter(writer))
        return writer.toString()
    }

    private fun setStatus(message: String) {
        runOnUiThread { statusView.text = message }
        android.util.Log.i(TAG, message)
    }

    companion object {
        private const val PREFS = "swiftcause_device_controller"
        private const val TAG = "SwiftCauseE2E"
    }
}
