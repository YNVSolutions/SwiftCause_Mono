# Stripe Webhook Idempotency Flow

## Purpose

This document explains how the backend prevents duplicate side effects when Stripe delivers the same webhook more than once or when related webhook types race each other.

The primary risk is not just duplicate HTTP requests. The real risk is duplicate business effects:

- two donation records for one payment
- campaign totals incremented twice
- recurring payment metadata written inconsistently
- replayed webhook deliveries creating new state

The implementation in this repository prevents those outcomes with two separate idempotency layers:

1. event-level idempotency for each Stripe `event.id`
2. business-object idempotency for each donation `transactionId`

Both layers are required.

## Relevant Files

- [backend/functions/handlers/webhooks.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/handlers/webhooks.js)
- [backend/functions/shared/firestore.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/shared/firestore.js)
- [backend/functions/entities/donation.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/entities/donation.js)
- [backend/functions/shared/firestore.test.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/shared/firestore.test.js)
- [backend/functions/entities/donation.test.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/entities/donation.test.js)
- [backend/functions/handlers/webhooks.test.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/handlers/webhooks.test.js)

## Why Stripe Idempotency Is Necessary

Stripe webhook delivery is at-least-once, not exactly-once.

That means:

- Stripe can retry the same event after a timeout or non-2xx response
- delivery attempts can overlap
- related event types can arrive in different orders
- replaying historical events is possible during debugging or recovery

Because of that, webhook code must assume duplicate delivery is normal.

## Architecture Overview

The backend processes Stripe webhooks in two main endpoints:

- `handlePaymentCompletedStripeWebhook`
- `handleSubscriptionWebhook`

Each endpoint follows the same high-level pattern:

1. verify Stripe signature
2. atomically claim the webhook event
3. if claim fails, acknowledge and stop
4. execute business side effects
5. mark the event as processed
6. if side effects fail, mark the event as failed

This is the first idempotency boundary.

The second boundary is inside donation creation:

1. use `transactionId` as the Firestore donation document ID
2. create or enrich the donation in a Firestore transaction
3. update campaign counters in the same transaction

This prevents double counting even when different webhook types converge on the same payment.

## Layer 1: Event-Level Idempotency

### Collection

Firestore collection:

- `webhook_events`

Document ID:

- Stripe `event.id`

### Claim Operation

The claim happens in [firestore.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/shared/firestore.js#L11) via `claimWebhookEvent(...)`.

The function uses a Firestore transaction:

- read `webhook_events/{eventId}`
- if it does not exist, create it with `status: "processing"`
- if it exists with `status: "failed"`, reclaim it for retry
- otherwise return `false`

This makes the claim atomic.

### Why This Works

Without a transaction, two workers could do:

1. worker A reads "event not found"
2. worker B reads "event not found"
3. both process side effects
4. both mark processed

That is the classic check-then-write race.

With the Firestore transaction, only one worker wins the claim for a given `event.id`.

### What Happens on Duplicate Delivery

If Stripe sends the same event again:

- the second request attempts the same claim
- claim returns `false`
- the handler returns `200 OK`
- no duplicate side effects run

This is important. Duplicate deliveries are acknowledged, not treated as application errors.

### Status Lifecycle

The event doc moves through these states:

- `processing`
- `processed`
- `failed`

Fields typically stored include:

- `eventId`
- `eventType`
- `objectId`
- `attempts`
- `claimedAt`
- `processedAt`
- `failedAt`
- `error`

### Replay Behavior

If an event is already `processed`, replaying it will not reopen processing.

If an event is `failed`, the implementation allows reclaiming it. That gives controlled retry behavior without removing the event record.

## Layer 2: Donation-Level Idempotency

Event-level locking alone is not enough.

Why:

- Stripe can emit different event types for the same payment
- those event types have different `event.id` values
- event-level locking only protects one event document at a time

This is especially relevant for recurring payments where:

- `payment_intent.succeeded`
- `invoice.paid`

can both resolve to the same payment.

### Donation Key

Donation idempotency uses:

- `transactionId`

as the Firestore document ID in `donations/{transactionId}`.

This means all writes related to the same payment converge on the same document.

### Transactional Donation Write

The write happens in [donation.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/entities/donation.js#L40).

It now uses a Firestore transaction that:

1. reads `donations/{transactionId}`
2. if it does not exist:
   creates the donation
3. if it exists:
   enriches only missing fields
4. if a new donation is created and `campaignId` exists:
   updates campaign totals in the same transaction

This closes the second major race.

### Why The Campaign Update Must Be In The Same Transaction

Previously, this sequence was possible:

1. webhook A reads donation missing
2. webhook B reads donation missing
3. webhook A creates donation
4. webhook B creates donation or reaches the same branch
5. webhook A increments campaign stats
6. webhook B increments campaign stats

Even if the donation doc ultimately converged, the campaign counters could still end up double-counted.

Putting donation creation and campaign increments in the same Firestore transaction means:

- only the winner creates the donation
- only the winner increments `raised`
- only the winner increments `donationCount`

### Enrichment Behavior

When the donation already exists, later webhook processing does not overwrite everything.

It only fills in missing fields such as:

- `subscriptionId`
- `invoiceId`
- `recurringInterval`
- `campaignTitleSnapshot`
- `donorEmail`

This is intentional. Different Stripe event types may carry different metadata completeness.

The system keeps the first successful donation record and lets later events add missing details without changing the financial effect.

## Full Flow For `payment_intent.succeeded`

1. Stripe sends webhook to `handlePaymentCompletedStripeWebhook`
2. backend verifies signature
3. backend calls `claimWebhookEvent(event.id, event.type, ...)`
4. if claim fails, return `200 OK`
5. resolve metadata from payment intent and, if needed, invoice and subscription lookups
6. call `createDonationDoc(...)`
7. inside `createDonationDoc(...)`, Firestore transaction:
   - create donation if absent
   - or enrich it if already present
   - update campaign stats only on first creation
8. create Gift Aid declaration if needed
9. mark webhook event as `processed`
10. return `200 OK`

## Full Flow For `invoice.paid`

1. Stripe sends webhook to `handleSubscriptionWebhook`
2. backend verifies signature
3. backend atomically claims `event.id`
4. if claim fails, return `200 OK`
5. resolve subscription data
6. call `createDonationDoc(...)` with `transactionId = invoice.payment_intent || invoice.id`
7. donation transaction ensures:
   - existing donation is enriched only
   - campaign totals are not incremented twice
8. create Gift Aid declaration if needed
9. update subscription analytics
10. mark event as `processed`

## Why Two Layers Are Necessary

These two protections solve different failure modes.

### Event lock solves:

- duplicate delivery of the same Stripe event
- overlapping retries for the same event
- exact replay of a previously processed event

### Donation transaction solves:

- different Stripe events targeting the same payment
- duplicate financial side effects from converging webhook paths
- campaign total double increments

If either layer is removed, idempotency is incomplete.

## Failure Handling

If business processing throws after the claim succeeds:

- the event is marked `failed`
- the HTTP response is `500`

This allows the event to be retried later because `claimWebhookEvent(...)` explicitly allows reclaiming failed events.

This is an intentional tradeoff:

- do not silently swallow failures
- do preserve enough state to retry safely

## Deterministic Behavior On Replay

The desired replay behavior is:

- same event delivered again after success: acknowledge and do nothing
- same event delivered again after failure: allow reprocessing
- different event for same payment: do not duplicate donation or campaign totals

That is the exact behavioral contract this implementation is trying to guarantee.

## Test Coverage

### 1. Event claim concurrency

[firestore.test.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/shared/firestore.test.js#L13)

This verifies:

- two parallel claims for the same `event.id` do not both succeed
- a processed event cannot be reopened by replay

### 2. Donation transaction concurrency

[donation.test.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/entities/donation.test.js#L10)

This verifies:

- two parallel writes with the same `transactionId` create only one donation
- campaign totals increment once
- later writes enrich missing fields instead of duplicating side effects

### 3. Handler-level duplicate delivery

[webhooks.test.js](/c:/Users/yuvra/OneDrive/Documents/GitHub/SwiftCause_Web/backend/functions/handlers/webhooks.test.js#L54)

This verifies:

- two parallel invocations of the payment webhook handler with the same event only run donation creation once
- the event record ends in `processed`

## Manual Verification

To test this manually:

1. run backend tests locally
2. start Firebase functions emulator or deploy the functions
3. use Stripe CLI to send or replay webhook events
4. inspect Firestore state after each run

Commands:

```powershell
cd backend/functions
npm.cmd test
npm.cmd run lint
cd ..
firebase emulators:start --only functions
```

What to inspect:

- `webhook_events/{eventId}`
- `donations/{transactionId}`
- `campaigns/{campaignId}`

Expected outcomes:

- duplicate same-event delivery creates one business effect
- replayed processed event does not run side effects
- recurring payment race across event types produces one donation and one campaign increment

## Operational Notes

### Firestore collection growth

`webhook_events` will keep growing unless old entries are archived or TTL-managed. If this collection becomes operationally noisy, add a retention policy.

### Observability

Useful signals to monitor:

- event docs stuck in `processing`
- repeated `failed` claims
- donation enrichment frequency
- campaign counter mismatches

### Recovery

If a webhook failed after claim but before completion:

- inspect the `webhook_events` doc
- inspect whether the donation already exists
- replay only after understanding partial side effects

The current design makes replay much safer, but operational recovery should still validate final Firestore state.

## Current Guarantees

With the current implementation, the backend guarantees:

- the same Stripe `event.id` is processed at most once successfully
- a processed event replay is acknowledged without repeating side effects
- the same `transactionId` does not create duplicate donation records
- campaign totals are incremented only on first donation creation
- later webhook paths may enrich missing donation metadata without changing the financial effect

## Non-Goals

This flow does not try to guarantee:

- exactly-once delivery from Stripe
- globally ordered webhook processing across different event types
- zero operational work for genuinely partial failures outside the transaction boundary

It guarantees idempotent business outcomes inside the backend despite those constraints.
