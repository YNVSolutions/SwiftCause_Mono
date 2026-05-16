# Authentication Flow

This document describes the current authentication flow in SwiftCause, with emphasis on the admin email/password experience and the forgot-password flow.

## Overview

SwiftCause currently supports two primary access paths:

- Admin login with email and password
- Kiosk login with kiosk ID and access code

The admin flow also includes:

- Signup
- Email verification
- Resend verification email
- Forgot password request
- Password reset confirmation

For the detailed current signup implementation, see:

- `docs/SIGNUP_FLOW.md`

## Main Files

### Admin auth flow

- `app/login/page.tsx`
- `src/views/auth/LoginScreen.tsx`
- `src/features/auth-by-email/ui/AdminLoginForm.tsx`
- `src/views/admin/AdminLogin.tsx`
- `src/features/auth-by-email/hooks/useAdminLogin.ts`
- `src/features/auth-by-email/hooks/useAuth.ts`
- `src/features/auth-by-email/api/authApi.ts`
- `src/shared/lib/auth-provider.tsx`

### Signup and verification

- `app/signup/page.tsx`
- `app/signup/SignupPageClient.tsx`
- `app/auth/verify-email/page.tsx`
- `app/auth/action/page.tsx`
- `src/views/auth/EmailVerificationPendingScreen.tsx`
- `src/views/auth/EmailVerificationSuccessScreen.tsx`

### Forgot password and reset password

- `app/forgot-password/page.tsx`
- `app/auth/action/page.tsx`
- `src/features/auth-by-email/hooks/useForgotPassword.ts`
- `src/views/auth/ForgotPasswordScreen.tsx`
- `src/views/auth/ResetPasswordScreen.tsx`
- `src/features/auth-by-email/lib/passwordResetAudit.ts`

## Authentication Modes

### 1. Admin login

Admin users authenticate with Firebase Auth email/password credentials.

After Firebase auth succeeds:

- the app checks whether the email is verified
- the app loads the user profile from Firestore `users`
- the app builds an admin session
- the user is routed to `/admin`

### 2. Kiosk login

Kiosk users do not use the admin email/password flow. They authenticate through the kiosk flow and are routed to `/campaigns`.

This document focuses on the admin flow.

## Admin Signup Flow

The signup flow is handled primarily in `src/shared/lib/auth-provider.tsx`.

### Steps

1. User fills the signup form.
2. If a reCAPTCHA token exists, the app calls the backend `verifySignupRecaptcha` function.
3. The app creates the Firebase Auth user with `createUserWithEmailAndPassword`.
4. The app creates a Firestore user document in `users`.
5. The app creates an organization document in `organizations`.
6. The app generates a verification token and stores it in the user document.
7. The app sends a verification email using Firebase Auth.
8. The app does not establish a full in-app session until email verification is complete.

### Stored user fields

The Firestore user document includes fields such as:

- `username`
- `email`
- `role`
- `permissions`
- `isActive`
- `createdAt`
- `organizationId`
- `emailVerified`

### Verification email behavior

Verification email generation uses:

- a custom verification token saved to Firestore
- a continue URL pointing to `/auth/verify-email`

If Firebase rejects the custom continue URL with `auth/unauthorized-continue-uri`, the code falls back to Firebase-hosted email verification.

## Email Verification Flow

Verification is split across two routes:

- `/auth/verify-email`
- `/auth/action`

### Pending verification screen

After signup, users land on the verification pending flow and can resend the verification email.

### Verification completion

`app/auth/action/page.tsx` handles Firebase action links.

When `mode=verifyEmail`:

1. The page reads `oobCode` from the query string.
2. It calls `authApi.verifyEmailCode(oobCode)`.
3. If a custom verification token exists in the `continueUrl`, it calls `authApi.completeEmailVerification(uid, token)`.
4. Firestore is updated to reflect the verified email state.
5. The success screen is shown and the user can continue to login.

### Resend verification email

Resend is supported when the current Firebase Auth user still exists in the browser session.

The resend flow:

1. Checks `auth.currentUser`
2. Verifies that the current user email matches the requested email
3. Sends a new verification email

If there is no current user, the app treats the session as expired and asks the user to sign up again.

## Admin Login Flow

The login UI starts at `app/login/page.tsx` and renders `LoginScreen`.

`LoginScreen` displays two cards:

- Organization Admin
- Kiosk Terminal

The admin card renders `AdminLoginContainer`, which uses `useAdminLogin`.

### Detailed login sequence

1. User enters email and password.
2. `useAdminLogin` first calls `authApi.signInForVerificationCheck(email, password)`.
3. If Firebase login succeeds but `user.emailVerified` is `false`, login is blocked.
4. The UI shows an error asking the user to verify their email.
5. A resend verification action becomes available.
6. If the email is verified, `useAuth().login(email, password)` is called.
7. `authApi.signIn()` signs in again, loads the Firestore user, and updates:
   - `lastLogin`
   - `emailVerified`
   - `emailVerifiedAt` when applicable
8. The hook checks:
   - user exists
   - user is active
   - user has an `organizationId`
9. The app builds an `AdminSession`.
10. `app/login/page.tsx` routes the user to `/admin`.

### Friendly login errors

The login hooks map Firebase errors to user-facing messages, including:

- invalid credentials
- invalid email
- disabled account
- too many requests
- network issues

## Auth Provider Session Flow

`src/shared/lib/auth-provider.tsx` is responsible for restoring auth state and translating Firebase auth into app session state.

### On app load

1. `onAuthStateChanged` listens for Firebase auth state changes.
2. If a Firebase user exists:
   - token data is refreshed
   - kiosk users are detected from UID conventions
   - non-kiosk users must have `emailVerified = true`
3. For verified admin users, the app loads the Firestore user document.
4. If necessary, Firestore `emailVerified` is synced from Firebase Auth.
5. The provider creates `currentAdminSession`.

### Important behavior

If a Firebase user exists but the email is not verified:

- the app does not establish an admin session
- the user remains authenticated enough to support resend verification

## Forgot Password Flow

The forgot-password request route is:

- `/forgot-password`

The reset completion route is:

- `/auth/action?mode=resetPassword&oobCode=...`

## Forgot Password Request Flow

The page `app/forgot-password/page.tsx` renders `ForgotPasswordScreen` and uses `useForgotPassword`.

### Request steps

1. User opens `/forgot-password`.
2. User enters an email address.
3. `useForgotPassword` normalizes the email to lowercase and trims whitespace.
4. The hook validates the email format.
5. The hook checks a browser-local throttle window using `localStorage`.
6. If the browser has exceeded the reset request threshold, the UI shows a rate-limit message.
7. Otherwise, the app calls `authApi.sendPasswordResetEmail(email)`.
8. A generic success message is shown regardless of whether the email exists.

### Security behavior

The forgot-password flow intentionally does not reveal whether an account exists.

User-visible success message:

- If an account exists for that email, you will receive a password reset link shortly.

This prevents account enumeration.

### Browser-side throttle

The hook uses:

- `swiftcause_password_reset_attempts` in `localStorage`

Current settings:

- 15 minute throttle window
- maximum 3 attempts within that window

If throttled:

- the user sees a wait message
- an audit event is logged

## Password Reset Email Sending

The reset email is sent via Firebase Auth in `authApi.sendPasswordResetEmail`.

### Action code settings

The current action settings use:

- `handleCodeInApp: true`
- a continue URL based on `NEXT_PUBLIC_APP_URL`
- a URL of `/login?source=password-reset`

If Firebase rejects the configured continue URL, the code falls back to the default Firebase-hosted reset email behavior.

## Password Reset Confirmation Flow

Firebase reset links ultimately land on `app/auth/action/page.tsx`.

When `mode=resetPassword`:

1. The page reads `oobCode`.
2. It calls `authApi.verifyPasswordResetCode(oobCode)`.
3. If valid, Firebase returns the email address associated with the reset action.
4. The page renders `ResetPasswordScreen` in `ready` state.

### Reset form behavior

The reset form currently includes:

- `Password`
- `Confirm password`

Validation behavior:

- password must be at least 8 characters
- `Confirm password` must match `Password`
- submit stays disabled until both fields are valid

### Submission steps

1. User enters a new password.
2. User confirms the password.
3. The screen calls `onSubmit(newPassword)`.
4. `app/auth/action/page.tsx` calls `authApi.confirmPasswordReset(oobCode, newPassword)`.
5. On success, the page shows a password updated success state.
6. The user can return to `/login`.

### Invalid or expired reset links

If Firebase reports the action code as invalid, expired, or already used:

- the page moves to `invalid` state
- the user sees a reset link unavailable message
- the user is prompted to return to login and request a new reset email

### Weak password handling

If Firebase rejects the new password as weak:

- the page moves to `error` state
- the user is prompted to choose a stronger password

## Password Reset Audit Logging

Password reset activity is logged by `src/features/auth-by-email/lib/passwordResetAudit.ts`.

### Logged event types

- `password_reset_request`
- `password_reset_confirm`

### Logged statuses

- `attempted`
- `submitted`
- `throttled`
- `failed`
- `completed`
- `invalid_link`

### Logging details

The app sends audit events to the backend function:

- `logAuthEvent`

Payload fields include:

- masked email address
- client session ID
- current route
- error code
- metadata

### Client session tracking

A session identifier is stored in:

- `swiftcause_password_reset_session_id` in `sessionStorage`

This allows related reset attempts from the same browser session to be correlated without exposing the raw email address.

## Environment Dependencies

The current auth flow depends on:

- Firebase Auth
- Firestore
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_APP_URL`

### Important configuration notes

- Email/password auth must be enabled in Firebase Auth.
- Authorized domains and continue URLs must be configured correctly.
- If continue URL config is wrong, the code falls back to Firebase-hosted email actions.

## Current UX Summary

### What is already implemented

- Admin signup
- Verification email sending
- Verification resend
- Email verification completion
- Admin login
- Forgot-password request screen
- Password reset confirmation screen
- Browser-side reset throttling
- Password reset audit logging

### Current shape of the forgot-password experience

1. Login page exposes `Forgot password?`
2. User opens `/forgot-password`
3. User submits email
4. Generic success response is shown
5. User opens Firebase reset email
6. `/auth/action` validates the reset link
7. User enters `Password` and `Confirm password`
8. Password is updated
9. User returns to `/login`

## Suggested Future Improvements

- Add an explicit success toast on `/login` when returning from a password reset
- Add server-side rate limiting in addition to browser-local throttling
- Add automated tests for:
  - forgot-password submission
  - invalid reset link handling
  - password mismatch validation
  - successful reset completion
- Document the expected Firebase console configuration for email action URLs
