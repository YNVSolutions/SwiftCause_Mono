plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

val hasGoogleServicesConfig = listOf(
    "google-services.json",
    "src/debug/google-services.json",
    "src/release/google-services.json",
).any { layout.projectDirectory.file(it).asFile.exists() }

if (hasGoogleServicesConfig) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.warn("google-services.json not found; skipping Google Services plugin for this build.")
}

android {
    namespace = "com.example.swiftcause"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "com.example.swiftcause"
        minSdk = 26  // Required by Stripe Terminal SDK for Tap to Pay
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Stripe publishable key (safe to commit - it's meant to be public)
        buildConfigField(
            "String",
            "STRIPE_PUBLISHABLE_KEY",
            "\"pk_test_51RbHd9QKGKb5ypYFiKavxDZPvuYS2yQwSdXZ5Ul7EC74vZOoKnDvMfsLyfgXEpWxA51ozDTTV40OiiuK0STTmiyR00c1O0o9jh\""
        )

        // Magic link base URL (for generating QR codes)
        buildConfigField(
            "String",
            "MAGIC_LINK_BASE_URL",
            "\"https://swiftcause--swiftcause-app.us-east4.hosted.app\""
        )
        buildConfigField(
            "String",
            "KIOSK_API_BASE_URL",
            "\"https://us-central1-swiftcause-app.cloudfunctions.net/\""
        )
        buildConfigField("String", "FIREBASE_EMULATOR_HOST", "\"\"")
        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    buildTypes {
        debug {
            buildConfigField(
                "String",
                "KIOSK_API_BASE_URL",
                "\"http://10.0.2.2:5001/swiftcause-app/us-central1/\""
            )
            buildConfigField("String", "FIREBASE_EMULATOR_HOST", "\"10.0.2.2\"")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }

        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.functions)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // Serialization
    implementation(libs.kotlinx.serialization.json)

    // ViewModel
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)

    // DataStore
    implementation(libs.androidx.datastore.preferences)

    // Coil for image loading
    implementation(libs.coil.compose)

    // Stripe Payment SDK
    implementation(libs.stripe.android)

    // Stripe Terminal SDK (for Tap to Pay)
    implementation(libs.stripe.terminal)
    implementation(libs.stripe.terminal.ktx)
    implementation(libs.stripe.terminal.taptopay)

    // QR Code generation
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    implementation("androidx.compose.material:material-icons-extended")
}
