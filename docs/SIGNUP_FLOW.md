# Signup Flow

This document describes the current organization admin signup flow, including field capture, validation, backend checks, and persistence.

## Scope

The signup flow covers:

- Initial account creation for organization admins
- Charity/compliance profile capture
- reCAPTCHA verification
- Server-side payload validation and normalization
- Firestore persistence for user and organization records
- Email verification initiation

It does not cover post-signup admin approval workflows, Stripe onboarding completion, or login gating rules beyond email verification.

## Main Files

### Frontend routes and screen

- `app/signup/page.tsx`
- `app/signup/SignupPageClient.tsx`
- `src/views/auth/SignupScreen.tsx`

### Auth and function integration

- `src/shared/lib/auth-provider.tsx`
- `src/shared/config/functions.ts`
- `src/shared/types/common.ts`

### Backend functions

- `backend/functions/handlers/signup.js`
- `backend/functions/index.js`
- `backend/functions/handlers/signup.test.js`

## High-Level Sequence

1. User opens `/signup` and fills the multi-step signup form.
2. Client performs step-level validation and async checks:
   - email availability
   - organization ID/name availability
3. On submit, client includes `recaptchaToken` and calls auth provider signup.
4. Backend `verifySignupRecaptcha` validates reCAPTCHA token (and rejects already-registered emails).
5. Backend `validateSignupProfile` validates and normalizes compliance fields.
6. Frontend creates Firebase Auth user with `contact_work_email` and password.
7. Frontend writes Firestore user document under `users/{uid}`.
8. Frontend writes Firestore organization document under `organizations/{organizationId}`.
9. Verification email flow is initiated and user is redirected to verification pending UI.

## Required Signup Data

The flow currently captures and submits:

- `legal_name`
- `charity_number`
- `registered_nation`
- `registered_postcode`
- `entity_type`
- `contact_full_name`
- `contact_role`
- `contact_work_email` (login identity)
- `contact_phone`
- `authorised_signatory`
- `gift_aid_registered`
- `hmrc_charity_reference` (conditional)
- `primary_setting`
- `estimated_monthly_volume_band`
- `terms_accepted`
- `privacy_accepted`
- `marketing_consent` (optional)
- `password`, `confirmPassword`, `recaptchaToken`

## Server-Side Validation and Normalization

`validateSignupProfile` is the source of truth for signup payload integrity.

It validates:

- charity number format by nation
- UK postcode format
- UK phone format
- HMRC reference format (conditional on `gift_aid_registered = yes`)
- required enums/booleans

It normalizes:

- postcode to uppercase with single spacing
- contact email to lowercase
- contact phone to UK E.164 format
- HMRC reference to uppercase

On validation failure it returns:

- HTTP `422`
- structured `fieldErrors`

## Persistence Model

### User document (`users/{uid}`)

Stored core fields include:

- `username` (from `contact_full_name`)
- `email` (from normalized `contact_work_email`)
- `role`, `permissions`, `isActive`
- `organizationId`
- `emailVerified`
- `createdAt`

### Organization document (`organizations/{organizationId}`)

Stored fields include normalized compliance/profile data:

- identity/contact fields listed above
- `gift_aid_registered`, `hmrc_charity_reference`
- `primary_setting`, `estimated_monthly_volume_band`
- consent booleans and timestamps
- policy version hashes for terms/privacy/marketing
- signatory boolean + timestamp + legal-name snapshot

## Error Handling

- Frontend shows toast errors for signup failures.
- Validation failures surface first field error from backend response.
- reCAPTCHA failures are surfaced before account creation.
- On failed submit, reCAPTCHA is reset and token cleared.

## Deployment Notes

This flow depends on both functions being deployed:

- `verifySignupRecaptcha`
- `validateSignupProfile`

Function URL mappings are defined in:

- `src/shared/config/functions.ts`

## Test Coverage

Signup backend tests currently cover:

- normalization success path
- charity number validation by nation
- HMRC conditional requirement
- UK phone validation
- `422` response with field errors
- reCAPTCHA handler success/failure paths

See:

- `backend/functions/handlers/signup.test.js`
