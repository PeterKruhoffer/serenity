import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { Auth, DatabaseReader, DatabaseWriter } from "./_generated/services";
import publication from "./publication.spec";
import { Conflict, Forbidden, InvalidInput, Unauthenticated } from "./workspace.spec";

const getIdentity = Effect.gen(function* () {
  const auth = yield* Auth;
  return yield* auth.getUserIdentity.pipe(
    Effect.mapError(() => new Unauthenticated({ message: "Sign in to manage publication." })),
  );
});

const membershipFor = (organizationId: GenericId<"organizations">, identityToken: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const membership = yield* reader
      .table("organization_memberships")
      .get("by_organizationId_and_identityToken", organizationId, identityToken)
      .pipe(
        Effect.mapError(() => new Forbidden({ message: "You cannot access this organization." })),
      );
    if (membership.status !== "active") {
      return yield* Effect.fail(new Forbidden({ message: "Your access is suspended." }));
    }
    return membership;
  });

const requireEventAccess = (eventId: GenericId<"events">, identityToken: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const event = yield* reader
      .table("events")
      .get(eventId)
      .pipe(Effect.mapError(() => new Forbidden({ message: "You cannot access this event." })));
    const membership = yield* membershipFor(event.organizationId, identityToken);
    if (membership.role === "event_manager") {
      const assignment = yield* reader
        .table("team_memberships")
        .index("by_teamId_and_identityToken", (q) =>
          q.eq("teamId", event.teamId).eq("identityToken", identityToken),
        )
        .first();
      if (assignment._tag === "None") {
        return yield* Effect.fail(new Forbidden({ message: "You cannot access this event." }));
      }
    }
    return { event, membership };
  });

const reviewNote = (note: string) => {
  const normalized = note.trim();
  if (normalized.length > 2_000) {
    return Effect.fail(
      new InvalidInput({ message: "Review notes cannot exceed 2,000 characters." }),
    );
  }
  return Effect.succeed(normalized);
};

const listPending = FunctionImpl.make(
  databaseSchema,
  publication,
  "listPending",
  ({ organizationId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const membership = yield* membershipFor(organizationId, identity.tokenIdentifier);
      if (membership.role !== "super_user") {
        return yield* Effect.fail(
          new Forbidden({ message: "Only super users can review event revisions." }),
        );
      }
      const revisions = yield* reader
        .table("event_revisions")
        .index("by_organizationId_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "submitted"),
        )
        .take(100);
      return yield* Effect.forEach(revisions, (revision) =>
        Effect.gen(function* () {
          const team = yield* reader.table("teams").get(revision.teamId).pipe(Effect.orDie);
          return {
            id: revision._id,
            eventId: revision.eventId,
            revisionNumber: revision.revisionNumber,
            title: revision.title,
            teamName: team.name,
            occurrenceCount: revision.occurrenceCount,
            sessionCount: revision.sessionCount,
            submittedAt: revision.submittedAt,
          };
        }),
      );
    }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const getPublished = FunctionImpl.make(databaseSchema, publication, "getPublished", ({ eventId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const { event } = yield* requireEventAccess(eventId, identity.tokenIdentifier);
    if (!event.publishedRevisionId || !event.publishedVersion) {
      return yield* Effect.fail(
        new Conflict({ message: "This event does not have a published version yet." }),
      );
    }
    const revision = yield* reader
      .table("event_revisions")
      .get(event.publishedRevisionId)
      .pipe(Effect.orDie);
    const dates = yield* reader
      .table("revision_dates")
      .index("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revision._id))
      .take(100);
    const publishedDates = yield* Effect.forEach(dates, (date) =>
      Effect.gen(function* () {
        const sessions = yield* reader
          .table("revision_sessions")
          .index("by_revisionDateId_and_sortOrder", (q) => q.eq("revisionDateId", date._id))
          .take(100);
        return {
          startsAt: date.startsAt,
          endsAt: date.endsAt,
          venueName: date.venueName,
          status: date.status,
          sessions: sessions.map((session) => ({
            title: session.title,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            roomName: session.roomName,
          })),
        };
      }),
    );
    return {
      eventId,
      revisionId: revision._id,
      version: event.publishedVersion,
      title: revision.title,
      description: revision.description,
      timezone: revision.timezone,
      dates: publishedDates,
    };
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const submit = FunctionImpl.make(databaseSchema, publication, "submit", ({ eventId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const { event } = yield* requireEventAccess(eventId, identity.tokenIdentifier);
    if (event.status !== "draft") {
      return yield* Effect.fail(new Conflict({ message: "Only drafts can be submitted." }));
    }
    const alreadySubmitted = yield* reader
      .table("event_revisions")
      .index("by_eventId_and_status", (q) => q.eq("eventId", eventId).eq("status", "submitted"))
      .take(1);
    if (alreadySubmitted.length > 0) {
      return yield* Effect.fail(
        new Conflict({ message: "This event already has a revision awaiting review." }),
      );
    }
    const dates = yield* reader
      .table("event_dates")
      .index("by_eventId_and_sortOrder", (q) => q.eq("eventId", eventId))
      .take(100);
    if (dates.length === 0) {
      return yield* Effect.fail(
        new InvalidInput({ message: "Add at least one date before submitting." }),
      );
    }
    const latestRevision = yield* reader
      .table("event_revisions")
      .index("by_eventId_and_revisionNumber", (q) => q.eq("eventId", eventId), "desc")
      .first();
    const revisionNumber =
      latestRevision._tag === "Some" ? latestRevision.value.revisionNumber + 1 : 1;
    const now = Date.now();
    const revisionId = yield* writer.table("event_revisions").insert({
      organizationId: event.organizationId,
      eventId,
      teamId: event.teamId,
      eventTypeVersionId: event.eventTypeVersionId,
      revisionNumber,
      status: "submitted",
      title: event.title,
      slug: event.slug,
      description: event.description,
      timezone: event.timezone,
      occurrenceCount: event.occurrenceCount,
      sessionCount: event.sessionCount,
      submittedByIdentity: identity.tokenIdentifier,
      submittedAt: now,
    });
    for (const date of dates) {
      const revisionDateId = yield* writer.table("revision_dates").insert({
        organizationId: event.organizationId,
        revisionId,
        sourceEventDateId: date._id,
        startsAt: date.startsAt,
        endsAt: date.endsAt,
        venueName: date.venueName,
        status: date.status,
        sortOrder: date.sortOrder,
      });
      const sessions = yield* reader
        .table("sessions")
        .index("by_eventDateId_and_sortOrder", (q) => q.eq("eventDateId", date._id))
        .take(100);
      for (const session of sessions) {
        yield* writer.table("revision_sessions").insert({
          organizationId: event.organizationId,
          revisionId,
          revisionDateId,
          sourceSessionId: session._id,
          title: session.title,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          roomName: session.roomName,
          sortOrder: session.sortOrder,
        });
      }
    }
    yield* writer.table("events").patch(eventId, { status: "submitted", updatedAt: now });
    yield* writer.table("audit_entries").insert({
      organizationId: event.organizationId,
      actorIdentity: identity.tokenIdentifier,
      action: "event.submitted",
      entityType: "event_revision",
      entityId: revisionId,
      summary: `Submitted revision ${revisionNumber} of ${event.title}`,
      occurredAt: now,
    });
    return { revisionId };
  }).pipe(
    Effect.catchTags({
      DocumentDecodeError: (error) => Effect.die(error),
      DocumentEncodeError: (error) => Effect.die(error),
      GetByIdFailure: (error) => Effect.die(error),
    }),
  ),
);

const approve = FunctionImpl.make(databaseSchema, publication, "approve", ({ revisionId, note }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const revision = yield* reader
      .table("event_revisions")
      .get(revisionId)
      .pipe(Effect.mapError(() => new Forbidden({ message: "Revision not found." })));
    const membership = yield* membershipFor(revision.organizationId, identity.tokenIdentifier);
    if (membership.role !== "super_user") {
      return yield* Effect.fail(
        new Forbidden({ message: "Only super users can approve revisions." }),
      );
    }
    if (revision.submittedByIdentity === identity.tokenIdentifier) {
      return yield* Effect.fail(
        new Forbidden({ message: "Revision authors cannot approve their own work." }),
      );
    }
    if (revision.status !== "submitted") {
      return yield* Effect.fail(
        new Conflict({ message: "This revision is no longer awaiting review." }),
      );
    }
    const event = yield* reader.table("events").get(revision.eventId).pipe(Effect.orDie);
    const normalizedNote = yield* reviewNote(note);
    const publishedVersion = (event.publishedVersion ?? 0) + 1;
    const now = Date.now();
    yield* writer.table("event_revisions").patch(revisionId, {
      status: "approved",
      reviewedByIdentity: identity.tokenIdentifier,
      reviewedAt: now,
      ...(normalizedNote ? { reviewNote: normalizedNote } : {}),
      publishedVersion,
    });
    yield* writer.table("events").patch(event._id, {
      status: "published",
      publishedRevisionId: revisionId,
      publishedVersion,
      updatedAt: now,
    });
    yield* writer.table("audit_entries").insert({
      organizationId: revision.organizationId,
      actorIdentity: identity.tokenIdentifier,
      action: "event.published",
      entityType: "event_revision",
      entityId: revisionId,
      summary: `Approved ${revision.title} as published version ${publishedVersion}`,
      occurredAt: now,
    });
    return { publishedVersion };
  }).pipe(
    Effect.catchTags({
      DocumentDecodeError: (error) => Effect.die(error),
      DocumentEncodeError: (error) => Effect.die(error),
      GetByIdFailure: (error) => Effect.die(error),
    }),
  ),
);

const reject = FunctionImpl.make(databaseSchema, publication, "reject", ({ revisionId, note }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const revision = yield* reader
      .table("event_revisions")
      .get(revisionId)
      .pipe(Effect.mapError(() => new Forbidden({ message: "Revision not found." })));
    const membership = yield* membershipFor(revision.organizationId, identity.tokenIdentifier);
    if (membership.role !== "super_user") {
      return yield* Effect.fail(
        new Forbidden({ message: "Only super users can reject revisions." }),
      );
    }
    if (revision.status !== "submitted") {
      return yield* Effect.fail(
        new Conflict({ message: "This revision is no longer awaiting review." }),
      );
    }
    const normalizedNote = yield* reviewNote(note);
    const now = Date.now();
    yield* writer.table("event_revisions").patch(revisionId, {
      status: "rejected",
      reviewedByIdentity: identity.tokenIdentifier,
      reviewedAt: now,
      ...(normalizedNote ? { reviewNote: normalizedNote } : {}),
    });
    yield* writer.table("events").patch(revision.eventId, {
      status: "draft",
      updatedAt: now,
    });
    yield* writer.table("audit_entries").insert({
      organizationId: revision.organizationId,
      actorIdentity: identity.tokenIdentifier,
      action: "event.rejected",
      entityType: "event_revision",
      entityId: revisionId,
      summary: `Rejected revision ${revision.revisionNumber} of ${revision.title}`,
      occurredAt: now,
    });
    return null;
  }).pipe(
    Effect.catchTags({
      DocumentDecodeError: (error) => Effect.die(error),
      DocumentEncodeError: (error) => Effect.die(error),
      GetByIdFailure: (error) => Effect.die(error),
    }),
  ),
);

const startDraft = FunctionImpl.make(databaseSchema, publication, "startDraft", ({ eventId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const writer = yield* DatabaseWriter;
    const { event } = yield* requireEventAccess(eventId, identity.tokenIdentifier);
    if (event.status !== "published") {
      return yield* Effect.fail(
        new Conflict({ message: "Only published events can start a new draft." }),
      );
    }
    const now = Date.now();
    yield* writer.table("events").patch(eventId, { status: "draft", updatedAt: now });
    yield* writer.table("audit_entries").insert({
      organizationId: event.organizationId,
      actorIdentity: identity.tokenIdentifier,
      action: "event.draft_started",
      entityType: "event",
      entityId: eventId,
      summary: `Started a new draft of ${event.title}`,
      occurredAt: now,
    });
    return null;
  }).pipe(
    Effect.catchTags({
      DocumentDecodeError: (error) => Effect.die(error),
      DocumentEncodeError: (error) => Effect.die(error),
      GetByIdFailure: (error) => Effect.die(error),
    }),
  ),
);

export default GroupImpl.make(databaseSchema, publication).pipe(
  Layer.provide(listPending),
  Layer.provide(getPublished),
  Layer.provide(submit),
  Layer.provide(approve),
  Layer.provide(reject),
  Layer.provide(startDraft),
  GroupImpl.finalize,
);
