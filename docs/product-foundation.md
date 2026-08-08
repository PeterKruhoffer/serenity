# Serenity v1 Product Foundation

## Purpose

Serenity is an event management platform for professionals who use it throughout the working day. It prioritizes excellent perceived performance, dependable workflows, clear authorization, and safe change management.

## Foundation

- **Organizations:** Users may belong to several teams; each event has one owning team. Initial roles are administrator, super user, and event manager.
- **Event types:** Organizations compose versioned types from built-in capabilities and typed fields: text, rich text, number, boolean, date/time, selects, URL, and entity references. Fields control their API visibility. Events remain pinned to a type version until explicitly migrated.
- **Event structure:** The event is the bookable unit and may contain several dated occurrences. Each event date has its own time, venue, status, and non-bookable schedule sessions.
- **Registration:** Registration covers the complete event. Acceptance is manual by default and optionally automatic. Participants may decline a date without withdrawing. A decline neither releases capacity nor can be reversed by the participant; managers have an audited override.
- **Capacity:** Only accepted registrations consume event-level capacity. Waiting lists are optional. Released capacity automatically accepts the next participant for auto-accept events or moves them to pending review otherwise. Complete withdrawal releases capacity.
- **Participants:** The customer's system remains authoritative. Serenity stores a minimal projection: external identifiers, display name, optional email and locale, synchronization metadata, and participation state. This supports resilient workflows and future transactional email without owning full profiles.
- **Payments:** Payments remain external. Serenity stores ticket names and prices, an external reference, and `not_required`, `unpaid`, `pending`, `paid`, or `refunded` status.

## Publication, API, and safety

Editing creates a draft revision isolated from the published event. An event manager submits the complete revision; a super user approves or rejects it. Approval atomically replaces the published snapshot. Cancellations use the same workflow, destructive actions are recoverable, and consequential activity is audited.

Every API operation requires scoped, revocable server-to-server credentials. Reads expose approved snapshots only. Registration operations may sign up, withdraw, or decline a date but cannot edit events or bypass approval. Credentials are organization-isolated; mutations are idempotent and audited. Nothing is public.

## Glossary

| Term                   | Meaning                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| Organization           | Customer boundary for teams, users, configuration, and API clients.   |
| Team                   | Single owner of an event.                                             |
| Event type             | Versioned template of capabilities, fields, defaults, and validation. |
| Event                  | Complete bookable offering covering all its dates.                    |
| Event date             | First-class scheduled occurrence within an event.                     |
| Session                | Non-bookable schedule item within an event date.                      |
| Participant projection | Minimal local identity and contact data sourced externally.           |
| Registration           | Application and participation state for the complete event.           |
| Date decline           | Decision not to attend one event date.                                |
| Capacity               | Maximum accepted registrations for an event.                          |
| Waiting list           | Ordered registrations awaiting capacity.                              |
| Draft revision         | Proposed changes isolated from production.                            |
| Published snapshot     | Approved event version exposed through the API.                       |
| API client             | Credentialed external system with organization-scoped permissions.    |
