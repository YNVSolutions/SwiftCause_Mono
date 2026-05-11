# Donor Subscription Management Portal

This document is the canonical guide for the donor-facing subscription management portal.
It replaces the temporary migration, quick-start, security-fix, and Stripe portal notes that were created during implementation.

## Scope

The portal lets a donor:

1. Enter an email at `/manage`.
2. Receive a one-time magic link.
3. Sign in with a Firebase custom-token session created from that magic link.
4. View a flat list of their subscriptions at `/manage/dashboard`.
5. Open Stripe Customer Portal for a selected subscription via the Manage button.

This flow is for donor self-service only. Admin subscription management remains separate.

## User Flow

```text
/manage
  email input
  POST sendSubscriptionMagicLink

email link
  /link/[token]
  POST verifySubscriptionMagicLink
  signInWithCustomToken

/manage/dashboard
  GET getSubscriptionsByEmail with Firebase ID token
  render flat subscription list

Manage button
  POST createCustomerPortalSession with subscriptionId only
  redirect to returned Stripe portal URL
```

## Frontend Files

- `src/views/manage/ManageEmailScreen.tsx`
  Sends the magic-link request.

- `src/views/manage/ManageCheckEmailScreen.tsx`
  Confirms that the donor should check their inbox and supports resend.

- `app/link/[token]/page.tsx`
  Tries subscription-management token verification first. If that fails, it falls back to the existing Gift Aid magic-link validation.

- `src/views/manage/ManageDashboardScreen.tsx`
  Requires a signed-in Firebase user, fetches subscriptions, and creates Stripe portal sessions.

- `src/features/subscription-management/ui/SubscriptionCard.tsx`
  Renders each subscription as an independent flat-list item.

## Backend Files

- `backend/functions/handlers/subscriptionManagement.js`
  Contains the five HTTPS handlers:
  - `sendSubscriptionMagicLink`
  - `verifySubscriptionMagicLink`
  - `getSubscriptionsByEmail`
  - `createCustomerPortalSession`
  - `getPaymentHistory`

- `backend/functions/utils/tokenManager.js`
  Generates, hashes, stores, verifies, consumes, and cleans up magic-link tokens.

- `backend/functions/services/email.js`
  Sends the subscription-management magic-link email.

- `backend/functions/entities/subscription.js`
  Writes subscription documents, including normalized donor email fields for lookup.

- `backend/functions/handlers/subscriptionManagement.test.js`
  63 tests covering all five endpoints: token flow, subscription listing, ownership validation, portal-session creation, payment history, and rate limiting.

## Firebase Functions

Production base URL:

```text
https://us-central1-swiftcause-app.cloudfunctions.net
```

Local emulator base URL:

```text
http://localhost:5001/swiftcause-app/us-central1
```

The frontend uses:

```text
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL
```

If the env var is absent, it falls back to the production Firebase Functions URL.

## API Reference

### sendSubscriptionMagicLink

```text
POST /sendSubscriptionMagicLink
```

Request:

```json
{
  "email": "donor@example.com"
}
```

Behavior:

- Validates email format.
- Normalizes the email to lowercase.
- Checks whether matching subscriptions exist.
- Always returns a generic success response for unknown emails to avoid email enumeration.
- Stores a hashed one-time token in `subscriptionMagicLinkTokens`.
- Sends a magic-link email through SendGrid.

Success response:

```json
{
  "success": true,
  "message": "If this email has active donations, you will receive a link shortly."
}
```

Development response may include:

```json
{
  "devLink": "http://localhost:3000/link/<token>"
}
```

### verifySubscriptionMagicLink

```text
POST /verifySubscriptionMagicLink
```

Request:

```json
{
  "token": "<plain magic-link token>"
}
```

Behavior:

- Hashes the supplied token.
- Fetches the token document.
- Rejects missing, expired, consumed, or invalid tokens.
- Consumes valid tokens in a Firestore transaction.
- Creates a Firebase custom token with donor subscription-management claims.

Success response:

```json
{
  "success": true,
  "email": "donor@example.com",
  "token": "<firebase custom token>"
}
```

The frontend must exchange this custom token with `signInWithCustomToken`, then use the resulting Firebase ID token for authenticated API calls.

### getSubscriptionsByEmail

```text
GET /getSubscriptionsByEmail
```

Authentication:

```text
Authorization: Bearer <Firebase ID token>
```

Behavior:

- Requires a valid Firebase ID token.
- Requires donor magic-link claims:
  - `purpose === "subscription_management"`
  - `type === "donor"`
- Uses the authenticated token email, not an email from query params or request body.
- Returns only subscriptions belonging to that email.
- Sorts active subscriptions first, then newest first by `createdAt`.
- Enriches campaign title and organization display name where campaign data is available.

Response:

```json
{
  "subscriptions": [
    {
      "id": "sub_123",
      "customerId": "cus_123",
      "campaignId": "campaign_123",
      "organizationId": "org_123",
      "amount": 3200,
      "currency": "gbp",
      "status": "active",
      "interval": "month",
      "intervalCount": 1,
      "currentPeriodEnd": {
        "seconds": 1770000000
      },
      "metadata": {
        "campaignTitle": "Example Campaign",
        "organizationName": "Example Charity"
      }
    }
  ],
  "count": 1
}
```

### createCustomerPortalSession

```text
POST /createCustomerPortalSession
```

Authentication:

```text
Authorization: Bearer <Firebase ID token>
```

Request:

```json
{
  "subscriptionId": "sub_123"
}
```

Behavior:

- Requires a valid donor subscription-management Firebase ID token.
- Accepts only `subscriptionId` from the frontend.
- Fetches the subscription document from Firestore.
- Extracts `customerId`, `organizationId`, and donor email from the subscription document.
- Validates that the authenticated email owns the subscription.
- Rejects ownership mismatch with `403`.
- Rejects missing subscription with `404`.
- Rejects data inconsistencies such as missing `customerId` with `500`.
- Creates a Stripe Customer Portal session and returns the portal URL.

Response:

```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/..."
}
```

### getPaymentHistory

```text
POST /getPaymentHistory
```

Authentication:

```text
Authorization: Bearer <Firebase ID token>
```

Request:

```json
{
  "subscriptionId": "sub_123"
}
```

Behavior:

- Requires a valid donor subscription-management Firebase ID token.
- Validates ownership: authenticated email must match the subscription's donor email.
- Queries donations in two ways and merges results:
  1. `subscriptionId` field match — covers all Stripe invoice-linked donations.
  2. `donorEmail + campaignId` match — fallback for legacy or kiosk donations not linked by `subscriptionId`.
- Deduplicates by donation document ID.
- Sorts newest first by `createdAt`.
- The frontend further deduplicates across multiple subscriptions to prevent duplicate React keys when a donor has multiple subscriptions to the same campaign.

Response:

```json
{
  "payments": [
    {
      "id": "don_123",
      "amount": 3200,
      "currency": "gbp",
      "status": "success",
      "campaignTitle": "Example Campaign",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "isGiftAid": false
    }
  ],
  "count": 1,
  "subscriptionId": "sub_123"
}
```

## Stripe Account Model

Current subscription creation uses platform Stripe customers and subscriptions with `transfer_data.destination` for the connected organization account.

That means:

- `customerId` lives on the platform Stripe account.
- Customer Portal sessions must be created on the platform account.
- The portal-session call does not pass a `stripeAccount` option.
- `organizationId` is still validated and the organization's Stripe account ID is checked as a data-integrity guard.

If the Stripe architecture changes so customers are created directly on connected accounts, this portal-session logic must change to pass the connected account context to Stripe.

## Firestore Data

### subscriptions

Relevant fields:

```javascript
{
  stripeSubscriptionId: string,
  customerId: string,
  campaignId: string,
  organizationId: string,
  amount: number,
  currency: string,
  status: string,
  interval: "month" | "year",
  intervalCount: number,
  donorEmail: string | null,
  donorEmailNormalized: string | null,
  currentPeriodEnd: Timestamp,
  startedAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  metadata: {
    donorEmail?: string,
    donorEmailNormalized?: string,
    campaignTitle?: string,
    organizationName?: string
  }
}
```

`donorEmailNormalized` should be used for reliable lookup. Existing legacy records may only have mixed-case `donorEmail`; those should be backfilled.

### subscriptionMagicLinkTokens

Document ID is the SHA-256 hash of the plain token.

```javascript
{
  email: string,
  purpose: "subscription_management",
  status: "active" | "consumed" | "expired",
  expiresAt: Timestamp,
  createdAt: Timestamp,
  consumedAt: Timestamp | null
}
```

Firestore rules deny client read/write access to this collection. Only backend functions should access it.

### rate_limits

Used exclusively by the Firestore-backed sliding-window rate limiter on `createCustomerPortalSession`. Document ID is the donor's normalized email.

```javascript
{
  userId: string,           // normalized email
  timestamps: number[],     // ms timestamps of requests within current window
  updatedAt: number         // ms timestamp of last write
}
```

- Window: 60 seconds, max 10 requests per window.
- Read and write occur inside a Firestore transaction to prevent race conditions across Cloud Function instances.
- Timestamps older than the window are pruned on every write.
- Written with `merge: true` to preserve any extra fields.
- Fails open on Firestore errors so legitimate donors are never blocked by infra issues.
- No cleanup needed — old timestamps are pruned inline on each request.

## Security Requirements

- Do not trust email from the frontend for subscription listing or portal creation.
- Do not accept `customerId` from the frontend.
- Always fetch the subscription by `subscriptionId` on the backend before portal creation.
- Always validate ownership by comparing authenticated donor email to subscription donor email.
- Require donor magic-link custom claims for donor APIs.
- Return `401` for missing or invalid authentication.
- Return `403` for authenticated users attempting to manage someone else's subscription.
- Store only hashed magic-link tokens.
- Keep magic-link tokens one-time-use and time-limited.
- Keep token documents backend-only in Firestore rules.

## Deployment

### Required Firebase secrets

```bash
cd backend
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set SENDGRID_FROM_EMAIL
firebase functions:secrets:set SENDGRID_FROM_NAME
firebase functions:secrets:set STRIPE_SECRET_KEY
```

### Required frontend env

Production:

```env
NEXT_PUBLIC_APP_URL=https://your-production-domain
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=https://us-central1-swiftcause-app.cloudfunctions.net
```

Local emulator:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=http://localhost:5001/swiftcause-app/us-central1
```

Keep local values in `.env.local`, not in committed `.env`.

### Deploy Firestore config

```bash
cd backend
firebase deploy --only firestore:indexes,firestore:rules
```

### Deploy functions

```bash
cd backend
firebase deploy --only functions:sendSubscriptionMagicLink,functions:verifySubscriptionMagicLink,functions:getSubscriptionsByEmail,functions:createCustomerPortalSession,functions:getPaymentHistory
```

## Verification

Run the focused backend test suite:

```bash
npm --prefix backend/functions test -- subscriptionManagement.test.js
```

Run backend lint:

```bash
npm --prefix backend/functions run lint
```

Run targeted frontend lint for donor portal files:

```bash
npx eslint src/features/subscription-management/ui/SubscriptionCard.tsx src/views/manage/ManageDashboardScreen.tsx app/link/[token]/page.tsx src/views/manage/ManageEmailScreen.tsx src/views/manage/ManageCheckEmailScreen.tsx
```

Run the Next.js build:

```bash
npm run build
```

## Manual QA Checklist

- Enter a malformed email at `/manage`; validation should block or show an error.
- Enter an email with no subscriptions; response should be generic and should not reveal account existence.
- Enter an email with subscriptions; donor should receive a magic link.
- Open the magic link within 15 minutes; user should land on `/manage/dashboard`.
- Reopen the same magic link; it should fail because the token was consumed.
- Wait beyond token expiry; token should fail.
- Dashboard should show only subscriptions for the authenticated donor.
- Active subscriptions should appear before inactive subscriptions.
- Every subscription should render as a separate item.
- Each item should show campaign title, organization, amount, interval, status, and a Manage button.
- Manage should send only `subscriptionId`.
- Managing a subscription owned by another donor should return `403`.
- Missing or invalid auth should return `401`.
- Missing subscription should return `404`.
- Missing `customerId` should log a data inconsistency and return an error.
- A valid Manage action should redirect to Stripe Customer Portal.

## Known Follow-Ups

- Backfill `donorEmailNormalized` and `metadata.donorEmailNormalized` for existing subscription records that were created before this feature.
- Remove the `devLink` field from the `sendSubscriptionMagicLink` production response once SendGrid is functional. Currently, when email delivery fails, the magic link is returned in the response body so the flow remains testable. This is a security risk in production.
- Add a scheduled cleanup Cloud Function for old consumed/expired `subscriptionMagicLinkTokens` documents (`tokenManager.js` already exports `cleanupExpiredTokens` and `deleteOldTokens` for this purpose).
- Billing dates (`currentPeriodEnd`, `nextPaymentAt`) are intentionally not displayed on the dashboard because the current Firestore data is incorrect. Re-enable once data quality is confirmed.

## Retired Temporary Docs

The following temporary root-level docs were consolidated into this file and should not be kept as source-of-truth documentation:

- `MIGRATION_COMPLETE.md`
- `MIGRATION_PROGRESS.md`
- `PHASE_2_COMPLETE.md`
- `QUICK_START.md`
- `SECURITY_FIXES.md`
- `STRIPE_PORTAL_IMPLEMENTATION.md`
- `SUBSCRIPTION_MANAGEMENT_SETUP.md`
