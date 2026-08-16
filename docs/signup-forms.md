# Public sign-up forms

Each approved event revision contains an immutable sign-up form. Draft edits do not affect a live form until a new revision is approved.

## Iframe

```html
<iframe
  src="https://YOUR_SERENITY_APP/embed/events/EVENT_ID/signup"
  title="Event sign-up"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

The frame posts two messages to its parent:

- `serenity.embed.resize` with `eventId` and `height`
- `serenity.signup.complete` with `eventId`, `registrationId`, and `status`

The parent can use the resize message to update the iframe height.

## JSON API

The API is served from the deployment's Convex HTTP Actions URL, normally the configured `VITE_CONVEX_URL` with `.convex.cloud` changed to `.convex.site`.

### Read a published form

```http
GET /api/v1/events/EVENT_ID/signup-form
```

The response includes event details, registration state, and ordered `signupFields`. Answers must reference the returned revision field IDs.

### Register

```http
POST /api/v1/events/EVENT_ID/registrations
Content-Type: application/json

{
  "attendeeKey": "64-lowercase-hex-characters",
  "displayName": "Alex Guest",
  "email": "alex@example.com",
  "locale": "en-US",
  "answers": [
    { "fieldId": "REVISION_FIELD_ID", "value": "Designer" },
    { "fieldId": "REVISION_FIELD_ID", "value": true },
    { "fieldId": "REVISION_FIELD_ID", "value": ["Vegetarian"] }
  ]
}
```

Generate `attendeeKey` from 32 cryptographically random bytes and retain it for that attendee. Repeating a registration with the same attendee key and event is idempotent. Text fields accept strings, yes/no fields accept booleans, and checkbox fields accept arrays containing only published options.

Public endpoints permit cross-origin browser requests and expose approved events only. Organizer and event-management APIs remain authenticated and organization-scoped.
