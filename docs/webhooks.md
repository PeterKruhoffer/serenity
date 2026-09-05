# Outbound webhooks

## Implementation status

The platform implementation is available in organization settings. Administrators can create up to
10 HTTPS endpoints, choose event subscriptions, send a test, enable or disable delivery, rotate the
one-time signing secret, inspect recent delivery status, and retry failed deliveries.

Before creating an endpoint, configure the platform deployment's server-only encryption key:

```sh
pnpm exec convex env set WEBHOOK_SECRET_ENCRYPTION_KEY \
  "$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")"
```

Do not reuse this key as a customer endpoint signing secret. Serenity generates a separate signing
secret for each endpoint and only reveals it when the endpoint is created or rotated. Changing the
deployment encryption key without re-encrypting existing endpoint secrets makes those endpoints
undeliverable.

## Goal

Serenity should notify a customer's system when published event or registration state changes. The
customer should not need to poll Serenity, and a temporary outage in the customer's system should
not lose an event.

This implementation covers outbound webhooks. Incoming integrations should continue to use versioned HTTP
API endpoints. An incoming webhook from a specific provider would be a separate feature because its
authentication and event model belong to that provider.

## Recommendation

Serenity uses an organization-scoped, versioned webhook API with at-least-once delivery. It records
the webhook event in the same Convex mutation as the domain change, then delivers it from an internal
action.
Consumers must deduplicate on the webhook event ID.

Do not derive webhook events from `audit_entries`. Audit entries contain human-readable summaries,
not stable payloads, and the current write paths do not audit every state transition. For example,
organizer acceptance, organizer withdrawal, date declines, decline reversals, and automatic waitlist
promotion can change state without creating an audit entry.

```diagram
┌──────────────────┐
│ Domain mutation  │
└────────┬─────────┘
         │ one transaction
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Domain state     │     │ Webhook event    │
│ changes          │     │ and deliveries   │
└──────────────────┘     └────────┬─────────┘
                                  │ durable schedule
                                  ▼
                         ┌──────────────────┐
                         │ Delivery action  │──── HTTP POST ───▶ Customer
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Attempt result   │
                         │ and next retry   │
                         └──────────────────┘
```

Convex records a function scheduled by a mutation only if that mutation commits. Scheduled actions
are not retried automatically because they may have external side effects. Serenity must therefore
record attempts and schedule its own retries. See the Convex documentation for
[scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions) and
[action error handling](https://docs.convex.dev/functions/actions#error-handling).

## First event catalogue

Start with state changes that customers are likely to copy into a CRM, payment system, messaging
system, or access-control workflow.

| Event type                           | Emitted when                                             |
| ------------------------------------ | -------------------------------------------------------- |
| `event.published`                    | A revision becomes the published event version           |
| `registration.created`               | A new registration is committed, with its initial status |
| `registration.accepted`              | A pending or waitlisted registration becomes accepted    |
| `registration.withdrawn`             | An attendee or organizer withdraws a registration        |
| `registration.date_declined`         | An attendee declines one event date                      |
| `registration.date_decline_reversed` | A manager reverses a date decline                        |

`registration.accepted` must also fire for automatic waitlist promotion. Do not add
`registration.updated` yet. A broad event with an untyped set of changed fields is hard for
consumers to use and easy to break.

Add payment events only when Serenity has a real payment-status mutation. Add draft editing events
only after a customer asks for them. Draft field changes are noisy and do not affect public event
state.

## Payload contract

Each delivery contains an immutable snapshot. It must not require the receiving system to fetch the
object before it can understand what happened.

```json
{
  "id": "jh7...",
  "type": "registration.accepted",
  "api_version": "2026-09-01",
  "created_at": "2026-09-02T10:42:17.123Z",
  "organization_id": "k57...",
  "data": {
    "registration": {
      "id": "m97...",
      "object_version": 2,
      "event_id": "j17...",
      "participant_id": "n27...",
      "external_participant_id": "crm-contact-1842",
      "status": "accepted",
      "payment_status": "not_required",
      "registered_at": "2026-09-01T08:15:00.000Z",
      "updated_at": "2026-09-02T10:42:17.123Z"
    }
  }
}
```

Use one published `api_version` for the whole envelope. Existing webhook events keep the payload
created under their original version, even if they are retried after a new version ships. Additive
fields are allowed within a version. Renaming, removing, or changing the meaning of a field requires
a new version.

Deliveries may arrive more than once or out of order. Add an integer version to each webhook-enabled
domain object and increment it in the mutation that changes that object. Consumers can then ignore a
payload whose `object_version` is older than the version they have already applied. Event publication
can use the existing published version; registrations need a new version field.

The first registration payload should include the customer's external participant ID and basic
registration state. Do not include sign-up answers by default. Answers may contain sensitive data
and can make payloads large. A later endpoint option can include fields explicitly marked for API
use.

## Signing and request rules

Generate a separate 256-bit secret for each endpoint and show it once when the endpoint is created or
rotated. Store only an encrypted form of the secret. Keep the encryption key in a typed Convex
environment variable, not in a table.

Send these headers:

```http
Content-Type: application/json
User-Agent: Serenity-Webhooks/1.0
Serenity-Event-Id: jh7...
Serenity-Event-Type: registration.accepted
Serenity-Signature: t=1788345737,v1=HEX_HMAC_SHA256
```

Calculate the signature over `timestamp + "." + exactRequestBody`. Consumers should reject a
timestamp more than five minutes from their clock and compare signatures in constant time. During
secret rotation, include one `v1` value for each active secret in the same header for a short overlap
period.

This fixture can be used to test an independent consumer implementation:

```text
secret: whsec_test_secret_123
timestamp: 1788345737
body: {"id":"evt_test_123","type":"webhook.test","api_version":"2026-09-01","created_at":"2026-09-02T10:42:17.123Z","organization_id":"org_test_123","data":{"test":{"message":"Serenity webhook endpoint test"}}}
signature: d059430540453432572f5f708b74899817dc162d7c26abf23dd6a59e74929a28
```

Only accept HTTPS endpoint URLs outside local, private, link-local, loopback, and reserved network
ranges. Do not follow redirects during delivery. URL validation alone is not enough because DNS can
change between configuration and delivery, so the delivery path must apply the same restrictions.
This prevents webhook configuration from becoming a server-side request forgery path.

## Delivery behavior

Treat any `2xx` response as success. Use a 10-second request timeout. Retry network failures, `408`,
`409`, `425`, `429`, and `5xx` responses. Do not retry other `4xx` responses or redirects. Honor a
reasonable `Retry-After` value without extending the overall retry window.

Suggested retry delays are immediate, 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours, 24 hours,
and 48 hours. Add jitter to delayed attempts. After the last attempt, mark the delivery failed and
keep it available for manual retry.

The guarantee is at least once, not exactly once. If the customer accepts a request but Serenity
loses the response, Serenity will retry it. The stable event ID makes this safe for a consumer that
records processed IDs.

Keep response status, duration, attempt time, and a short sanitized error or response excerpt. Never
store response headers because they can contain cookies or credentials. Cap the excerpt at 2 KB and
retain delivery records for 30 days at first.

Disable an endpoint after repeated terminal failures across distinct events, not merely after all
attempts for one event. Notify organization administrators before or when this happens. A `410`
response can disable the endpoint immediately.

## Data model

Keep configuration, immutable events, deliveries, and attempts separate. Attempts are unbounded and
must not be stored as an array on a delivery document.

### `webhook_endpoints`

- `organizationId`
- `url`
- `description`
- `status`: `active`, `disabled`, or `deleted`
- `subscribedEventTypes`: a bounded list from the supported catalogue
- `secretCiphertext`, `secretIv`, and `secretKeyVersion`
- `previousSecretCiphertext` and rotation expiry when rotation is active
- `createdByIdentity`, `createdAt`, and `updatedAt`
- consecutive failed-event count and optional disable reason

Limit an organization to 10 active endpoints in the first release. The event catalogue is small and
bounded, so an array of subscribed types is appropriate here.

### `webhook_events`

- `organizationId`
- `type`
- `apiVersion`
- `subjectType` and `subjectId`
- the complete serialized payload
- `occurredAt`

The payload is a snapshot, not a pointer to live rows. This keeps retries deterministic and prevents
a delayed `registration.created` event from showing a later `withdrawn` state.

### `webhook_deliveries`

- `organizationId`, `webhookEventId`, and `webhookEndpointId`
- `status`: `pending`, `attempting`, `delivered`, or `failed`
- `attemptCount`
- `nextAttemptAt`
- lease token and lease expiry for crash recovery
- latest response status and error summary
- `deliveredAt`

Use a unique logical pair of event and endpoint. Convex does not enforce unique indexes, so create
deliveries from the same transaction that creates the event and make that emission helper the only
write path.

### `webhook_delivery_attempts`

- `webhookDeliveryId` and attempt number
- start and finish timestamps
- outcome, response status, duration, and sanitized excerpt

## Backend ownership

`confect/` remains the source of truth. Add a `webhooks` feature group for authenticated endpoint
management and delivery-log queries. Restrict endpoint creation, rotation, disabling, deletion, and
manual retries to organization administrators. Super users and event managers may get read-only
delivery access later if customers need it.

Domain mutations should call one shared emission helper. It inserts the immutable webhook event,
creates a delivery for each active subscribed endpoint, and schedules each delivery in the same
transaction. The helper needs to work with both Confect's `DatabaseWriter` and the direct Convex
mutation context used by the public attendee functions.

The delivery action should:

1. Call an internal mutation that acquires a short delivery lease and returns the immutable payload
   and current endpoint configuration.
2. Decrypt the signing secret, sign the exact body, and make one HTTP request.
3. Call an internal mutation that records the attempt and either marks success, marks terminal
   failure, or schedules the next attempt.

A small cron should recover expired `attempting` leases. That covers an action crash after lease
acquisition. If the crash happened after the remote server accepted the request, recovery may create
a duplicate, which is consistent with the documented at-least-once contract.

Native Convex scheduling is enough for the first release. If delivery volume starts delaying other
scheduled work, move dispatch into the Convex Workpool component to cap parallel requests and isolate
webhook traffic. The event and delivery tables should remain the source of customer-visible status.

## Management experience

Add an administrator-only "Webhooks" section under organization settings with:

- endpoint URL and description
- event subscriptions
- one-time secret reveal and rotation
- active or disabled state
- recent delivery success rate and latest failure
- a delivery list with payload preview, attempt history, and manual retry
- a "Send test event" action using a clearly marked `webhook.test` payload

Creating an endpoint should perform a test delivery before activating it. Do not require a successful
test to save a disabled endpoint, since customers may configure Serenity before deploying their
receiver.

## Reference consumer and end-to-end testing

[Serenity Events](https://github.com/PeterKruhoffer/serenity-events) should be the reference webhook
consumer. It already demonstrates how a customer-facing site calls Serenity's attendee API from a
full-stack TanStack Start application. Webhooks let it also demonstrate the asynchronous half of the
integration.

Add a stable TanStack server route such as `src/routes/api/serenity-webhooks.ts`. The route should
read the raw request body, verify the timestamp and HMAC using a server-only
`SERENITY_WEBHOOK_SECRET`, claim the event ID in durable storage, and then dispatch on the event type.
Keep signature verification in a small server module that can be tested from documented payload and
signature fixtures.

Serenity Events owns an isolated Convex project with `webhookEvents` and `webhookObjectVersions`
tables. Its consumer helper atomically claims each event ID, advances newer object versions, and runs
future payload writes in the same transaction. Memory, cookies, and local files would not be safe for
this state because the application may run on concurrent or short-lived server instances.

Keep the customer boundary explicit. Serenity Events calls Serenity through `SERENITY_API_URL` and
receives public webhooks. It must not share Serenity's Convex project, deployment configuration,
deploy keys, or datastore. Storing consumer deduplication state in the Serenity platform would hide
a responsibility that every real customer integration must handle.

Use the two repositories at different testing levels:

- Serenity's backend tests cover the fixed signature fixture, URL restrictions, event snapshots,
  authorization, leases, retries, and stale completion protection. The staging test covers the real
  request bytes and headers across the public boundary.
- Serenity Events tests its signature verifier, duplicate event handling, out-of-order object
  versions, unknown event types, and its concrete business reaction to each supported event.
- A staging end-to-end test registers or withdraws an attendee through Serenity Events, waits for the
  corresponding webhook from Serenity, and asserts that Serenity Events applied one logical event.
  This is the test that catches drift between the platform and a separately deployed consumer.

Keep the consumer implementation independent of Serenity's internal webhook code. Sharing the
signature verifier would make the example shorter but could allow the same bug on both sides. Share
the published JSON schema or generated event types later if needed; keep signature verification and
deduplication independently implemented.

## Implemented scope and follow-up

The first release includes all event types in the catalogue, administrator-only endpoint management,
encrypted per-endpoint secrets, test events, manual retries, durable retry scheduling, expired-lease
recovery, endpoint disabling, delivery status, and the separate Serenity Events reference consumer.
Registration payloads intentionally omit participant email and sign-up answers. A receiver may be
enabled even if its test has not succeeded.

Before production use:

1. Configure the platform encryption key and the Serenity Events endpoint secret in their respective
   Convex deployments.
2. Deploy both applications and run the staging end-to-end test across the public webhook boundary.
3. Choose and implement the platform-wide retention policy. The initial recommendation is 30 days
   for attempts and at least 90 days for immutable events.

At higher volume, add Workpool concurrency controls if metrics justify them, backlog alerts, and
endpoint-level payload options for fields explicitly marked as API-visible.
