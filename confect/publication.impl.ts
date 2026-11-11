import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { EventsDoc } from "./_generated/docs";
import refs from "./_generated/refs";
import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter, MutationCtx, Scheduler } from "./_generated/services";
import { membershipFor, requireEventAccess, requireIdentity } from "./access";
import publication from "./publication.spec";
import { MAX_FORM_FIELDS, resolveEventForm } from "./signupForms";
import { Conflict, Forbidden, InvalidInput } from "./workspace.spec";
import { emitPublishedEventWebhook } from "./webhookEvents";

const getIdentity = requireIdentity("Sign in to manage publication.");

const reviewNote = (note: string) => {
  const normalized = note.trim();
  if (normalized.length > 2_000) {
    return Effect.fail(
      new InvalidInput({ message: "Review notes cannot exceed 2,000 characters." }),
    );
  }
  return Effect.succeed(normalized);
};

const canReviewRevisions = (role: "administrator" | "super_user" | "event_manager") =>
  role === "administrator" || role === "super_user";

const TEMPLATE_REFRESH_BATCH_SIZE = 10;

const writeRevisionSignupFields = (event: EventsDoc, revisionId: GenericId<"event_revisions">) =>
  Effect.gen(function* () {
    const writer = yield* DatabaseWriter;
    const fields = yield* resolveEventForm(event);
    yield* Effect.forEach(fields, (field, sortOrder) =>
      writer.table("revision_signup_fields").insert({
        organizationId: event.organizationId,
        revisionId,
        sourceSignupFieldId: field._id,
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options,
        ...(field.section === undefined ? {} : { section: field.section }),
        sortOrder,
      }),
    );
  });

/** Copies the event's current draft into a new revision awaiting review. */
const submitRevision = (event: EventsDoc, actorIdentity: string, reason = "") =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const eventId = event._id;
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
      capacity: event.capacity ?? 40,
      autoAccept: event.autoAccept ?? false,
      waitingListEnabled: event.waitingListEnabled ?? true,
      submittedByIdentity: actorIdentity,
      submittedAt: now,
    });
    yield* writeRevisionSignupFields(event, revisionId);
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
      actorIdentity,
      action: "event.submitted",
      entityType: "event_revision",
      entityId: revisionId,
      summary: `Submitted revision ${revisionNumber} of ${event.title}${reason}`,
      occurredAt: now,
    });
    return revisionId;
  });

const listPending = FunctionImpl.make(
  databaseSchema,
  publication,
  "listPending",
  ({ organizationId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const membership = yield* membershipFor(organizationId, identity.tokenIdentifier);
      if (!canReviewRevisions(membership.role)) {
        return yield* Effect.fail(
          new Forbidden({
            message: "Only administrators and super users can review event revisions.",
          }),
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
    const signupFields = yield* reader
      .table("revision_signup_fields")
      .index("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revision._id))
      .take(MAX_FORM_FIELDS);
    return {
      eventId,
      revisionId: revision._id,
      version: event.publishedVersion,
      title: revision.title,
      description: revision.description,
      timezone: revision.timezone,
      dates: publishedDates,
      signupFields: signupFields.map((field) => ({
        id: field._id,
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options,
        ...(field.section === undefined ? {} : { section: field.section }),
      })),
    };
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const submit = FunctionImpl.make(databaseSchema, publication, "submit", ({ eventId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
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
    const revisionId = yield* submitRevision(event, identity.tokenIdentifier);
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
    const ctx = yield* MutationCtx;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const revision = yield* reader
      .table("event_revisions")
      .get(revisionId)
      .pipe(Effect.mapError(() => new Forbidden({ message: "Revision not found." })));
    const membership = yield* membershipFor(revision.organizationId, identity.tokenIdentifier);
    if (!canReviewRevisions(membership.role)) {
      return yield* Effect.fail(
        new Forbidden({ message: "Only administrators and super users can approve revisions." }),
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
      isPubliclyListed: true,
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
    yield* Effect.promise(() => emitPublishedEventWebhook(ctx, event._id, now));
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
    if (!canReviewRevisions(membership.role)) {
      return yield* Effect.fail(
        new Forbidden({ message: "Only administrators and super users can reject revisions." }),
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

const refreshTemplateForms = FunctionImpl.make(
  databaseSchema,
  publication,
  "refreshTemplateForms",
  ({ templateId, actorIdentity, cursor }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const template = yield* reader
        .table("signup_form_templates")
        .get(templateId)
        .pipe(Effect.option);
      if (Option.isNone(template)) return null;
      const reason = ` after ${template.value.name} changed`;
      const linkedEvents = yield* reader
        .table("events")
        .index("by_signupTemplateId", (q) => q.eq("signupTemplateId", templateId))
        .paginate({ numItems: TEMPLATE_REFRESH_BATCH_SIZE, cursor: cursor ?? null });
      for (const event of linkedEvents.page) {
        // Drafts read the template when they are submitted, so only snapshots need refreshing.
        if (event.status === "published") {
          yield* submitRevision(event, actorIdentity, reason);
        } else if (event.status === "submitted") {
          const pending = yield* reader
            .table("event_revisions")
            .index("by_eventId_and_status", (q) =>
              q.eq("eventId", event._id).eq("status", "submitted"),
            )
            .first();
          if (Option.isNone(pending)) continue;
          const staleFields = yield* reader
            .table("revision_signup_fields")
            .index("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", pending.value._id))
            .take(MAX_FORM_FIELDS);
          yield* Effect.forEach(staleFields, (field) =>
            writer.table("revision_signup_fields").delete(field._id),
          );
          yield* writeRevisionSignupFields(event, pending.value._id);
          yield* writer.table("audit_entries").insert({
            organizationId: event.organizationId,
            actorIdentity,
            action: "event.revision_form_refreshed",
            entityType: "event_revision",
            entityId: pending.value._id,
            summary: `Updated the sign-up form in revision ${pending.value.revisionNumber} of ${event.title}${reason}`,
            occurredAt: Date.now(),
          });
        }
      }
      if (!linkedEvents.isDone) {
        const scheduler = yield* Scheduler;
        yield* scheduler.runAfter(Duration.zero, refs.internal.publication.refreshTemplateForms, {
          templateId,
          actorIdentity,
          cursor: linkedEvents.continueCursor,
        });
      }
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
  Layer.provide(refreshTemplateForms),
  Layer.provide(startDraft),
  GroupImpl.finalize,
);
