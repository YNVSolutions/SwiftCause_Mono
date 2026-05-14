package com.example.swiftcause.utils

import com.example.swiftcause.BuildConfig
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.firestore

object FirebaseManager {
    val auth: FirebaseAuth by lazy {
        Firebase.auth.apply {
            if (BuildConfig.FIREBASE_EMULATOR_HOST.isNotBlank()) {
                useEmulator(BuildConfig.FIREBASE_EMULATOR_HOST, 9099)
            }
        }
    }

    val firestore: FirebaseFirestore by lazy {
        Firebase.firestore.apply {
            if (BuildConfig.FIREBASE_EMULATOR_HOST.isNotBlank()) {
                useEmulator(BuildConfig.FIREBASE_EMULATOR_HOST, 8081)
            }
        }
    }
}
