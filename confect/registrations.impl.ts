import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter } from "./_generated/services";
import { requireEventAccess as requireEventAccessPolicy, requireIdentity } from "./access";
import registrations from "./registrations.spec";
import { Conflict, Forbidden, InvalidInput } from "./workspace.spec";

const getIdentity = requireIdentity("Sign in to manage registrations.");

const requireEventAccess = (
  eventId: Parameters<typeof requireEventAccessPolicy>[0],
  identityToken: string,
) => requireEventAccessPolicy(eventId, identityToken).pipe(Effect.map(({ event }) => event));

const requireRegistration = (registrationId: GenericId<"registrations">, identityToken: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const registration = yield* reader
      .table("registrations")
      .get(registrationId)
      .pipe(
        Effect.mapError(() => new Forbidden({ message: "You cannot access this registration." })),
      );
    const event = yield* requireEventAccess(registration.eventId, identityToken);
    return { registration, event };
  });

const normalize = (value: string, label: string, maximum = 160) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > maximum) {
    return Effect.fail(
      new InvalidInput({ message: `${label} must be between 1 and ${maximum} characters.` }),
    );
  }
  return Effect.succeed(normalized);
};

const list = FunctionImpl.make(databaseSchema, registrations, "list", ({ eventId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    yield* requireEventAccess(eventId, identity.tokenIdentifier);
    const rows = yield* reader
      .table("registrations")
      .index("by_eventId_and_status", (q) => q.eq("eventId", eventId))
      .take(250);
    return yield* Effect.forEach(rows, (registration) =>
      Effect.gen(function* () {
        const participant = yield* reader
          .table("participants")
          .get(registration.participantId)
          .pipe(Effect.orDie);
        const declines = yield* reader
          .table("date_declines")
          .index("by_registrationId_and_eventDateId", (q) =>
            q.eq("registrationId", registration._id),
          )
          .take(100);
        const storedAnswers = yield* reader
          .table("registration_answers")
          .index("by_registrationId", (q) => q.eq("registrationId", registration._id))
          .take(50);
        const answers = yield* Effect.forEach(storedAnswers, (answer) =>
          Effect.gen(function* () {
            const field = yield* reader
              .table("revision_signup_fields")
              .get(answer.revisionSignupFieldId)
              .pipe(Effect.orDie);
            const value =
              answer.valueType === "text"
                ? (answer.textValue ?? "")
                : answer.valueType === "boolean"
                  ? (answer.booleanValue ?? false)
                  : (answer.selectionValues ?? []);
            return { fieldId: field._id, label: field.label, value };
          }),
        );
        return {
          id: registration._id,
          participantId: participant._id,
          participantName: participant.displayName,
          ...(participant.email ? { participantEmail: participant.email } : {}),
          externalParticipantId: participant.externalId,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          registeredAt: registration.registeredAt,
          declinedDateIds: declines
            .filter((decline) => decline.status === "declined")
            .map((decline) => decline.eventDateId),
          answers,
        };
      }),
    );
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const configure = FunctionImpl.make(
  databaseSchema,
  registrations,
  "configure",
  ({ eventId, capacity, autoAccept, waitingListEnabled }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const writer = yield* DatabaseWriter;
      const event = yield* requireEventAccess(eventId, identity.tokenIdentifier);
      if (event.status !== "draft") {
        return yield* Effect.fail(
          new Conflict({ message: "Registration settings can only change in a draft." }),
        );
      }
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100_000) {
        return yield* Effect.fail(
          new InvalidInput({ message: "Capacity must be a whole number between 1 and 100,000." }),
        );
      }
      if (capacity < (event.acceptedCount ?? 0)) {
        return yield* Effect.fail(
          new Conflict({ message: "Capacity cannot be lower than the accepted count." }),
        );
      }
      yield* writer.table("events").patch(eventId, {
        capacity,
        autoAccept,
        waitingListEnabled,
        updatedAt: Date.now(),
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

const register = FunctionImpl.make(databaseSchema, registrations, "register", (args) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const event = yield* requireEventAccess(args.eventId, identity.tokenIdentifier);
    if (!event.publishedRevisionId) {
      return yield* Effect.fail(
        new Conflict({ message: "Registrations open after the event is published." }),
      );
    }
    const externalId = yield* normalize(args.externalParticipantId, "External participant ID");
    const displayName = yield* normalize(args.displayName, "Participant name");
    const participantMatch = yield* reader
      .table("participants")
      .index("by_organizationId_and_externalId", (q) =>
        q.eq("organizationId", event.organizationId).eq("externalId", externalId),
      )
      .first();
    const now = Date.now();
    const participantId = Option.isSome(participantMatch)
      ? yield* writer
          .table("participants")
          .patch(participantMatch.value._id, {
            displayName,
            ...(args.email.trim() ? { email: args.email.trim() } : {}),
            ...(args.locale.trim() ? { locale: args.locale.trim() } : {}),
            synchronizedAt: now,
          })
          .pipe(Effect.as(participantMatch.value._id))
      : yield* writer.table("participants").insert({
          organizationId: event.organizationId,
          externalId,
          displayName,
          ...(args.email.trim() ? { email: args.email.trim() } : {}),
          ...(args.locale.trim() ? { locale: args.locale.trim() } : {}),
          synchronizedAt: now,
        });
    const existing = yield* reader
      .table("registrations")
      .index("by_eventId_and_participantId", (q) =>
        q.eq("eventId", args.eventId).eq("participantId", participantId),
      )
      .first();
    if (Option.isSome(existing) && existing.value.status !== "withdrawn") {
      return { registrationId: existing.value._id, status: existing.value.status };
    }
    if (Option.isSome(existing)) {
      return yield* Effect.fail(
        new Conflict({ message: "A withdrawn registration cannot be reopened." }),
      );
    }
    const capacity = event.capacity ?? 40;
    const acceptedCount = event.acceptedCount ?? 0;
    const status: "accepted" | "waitlisted" | "pending" | null = event.autoAccept
      ? acceptedCount < capacity
        ? "accepted"
        : event.waitingListEnabled
          ? "waitlisted"
          : null
      : "pending";
    if (status === null) {
      return yield* Effect.fail(new Conflict({ message: "This event is at capacity." }));
    }
    const registrationId = yield* writer.table("registrations").insert({
      organizationId: event.organizationId,
      eventId: args.eventId,
      participantId,
      status,
      ticketName: args.ticketName.trim() || "Standard",
      priceMinor: args.priceMinor,
      paymentStatus: args.paymentStatus,
      registeredAt: now,
      updatedAt: now,
      ...(status === "accepted" ? { acceptedAt: now } : {}),
    });
    yield* writer.table("events").patch(args.eventId, {
      acceptedCount: status === "accepted" ? acceptedCount + 1 : acceptedCount,
      updatedAt: now,
    });
    yield* writer.table("audit_entries").insert({
      organizationId: event.organizationId,
      actorIdentity: identity.tokenIdentifier,
      action: "registration.created",
      entityType: "registration",
      entityId: registrationId,
      summary: `Registered ${displayName} for ${event.title} as ${status}`,
      occurredAt: now,
    });
    return { registrationId, status };
  }).pipe(
    Effect.catchTags({
      DocumentDecodeError: (error) => Effect.die(error),
      DocumentEncodeError: (error) => Effect.die(error),
      GetByIdFailure: (error) => Effect.die(error),
    }),
  ),
);

const accept = FunctionImpl.make(databaseSchema, registrations, "accept", ({ registrationId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const writer = yield* DatabaseWriter;
    const { registration, event } = yield* requireRegistration(
      registrationId,
      identity.tokenIdentifier,
    );
    if (registration.status !== "pending" && registration.status !== "waitlisted") {
      return yield* Effect.fail(
        new Conflict({ message: "Only pending or waitlisted registrations can be accepted." }),
      );
    }
    const acceptedCount = event.acceptedCount ?? 0;
    if (acceptedCount >= (event.capacity ?? 40)) {
      return yield* Effect.fail(new Conflict({ message: "This event is at capacity." }));
    }
    const now = Date.now();
    yield* writer.table("registrations").patch(registrationId, {
      status: "accepted",
      acceptedAt: now,
      updatedAt: now,
    });
    yield* writer.table("events").patch(event._id, {
      acceptedCount: acceptedCount + 1,
      updatedAt: now,
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

const withdraw = FunctionImpl.make(
  databaseSchema,
  registrations,
  "withdraw",
  ({ registrationId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const { registration, event } = yield* requireRegistration(
        registrationId,
        identity.tokenIdentifier,
      );
      if (registration.status === "withdrawn") return null;
      const now = Date.now();
      yield* writer.table("registrations").patch(registrationId, {
        status: "withdrawn",
        withdrawnAt: now,
        updatedAt: now,
      });
      if (registration.status === "accepted") {
        const next = yield* reader
          .table("registrations")
          .index("by_eventId_and_status", (q) =>
            q.eq("eventId", event._id).eq("status", "waitlisted"),
          )
          .first();
        if (Option.isSome(next)) {
          yield* writer.table("registrations").patch(next.value._id, {
            status: event.autoAccept ? "accepted" : "pending",
            updatedAt: now,
            ...(event.autoAccept ? { acceptedAt: now } : {}),
          });
        }
        yield* writer.table("events").patch(event._id, {
          acceptedCount:
            Option.isSome(next) && event.autoAccept
              ? (event.acceptedCount ?? 1)
              : Math.max(0, (event.acceptedCount ?? 1) - 1),
          updatedAt: now,
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

const declineDate = FunctionImpl.make(
  databaseSchema,
  registrations,
  "declineDate",
  ({ registrationId, eventDateId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const { registration, event } = yield* requireRegistration(
        registrationId,
        identity.tokenIdentifier,
      );
      const date = yield* reader
        .table("event_dates")
        .get(eventDateId)
        .pipe(Effect.mapError(() => new InvalidInput({ message: "Event date not found." })));
      if (date.eventId !== event._id) {
        return yield* Effect.fail(
          new InvalidInput({ message: "The date does not belong to this event." }),
        );
      }
      const existing = yield* reader
        .table("date_declines")
        .index("by_registrationId_and_eventDateId", (q) =>
          q.eq("registrationId", registrationId).eq("eventDateId", eventDateId),
        )
        .first();
      if (Option.isSome(existing)) {
        return yield* Effect.fail(
          new Conflict({ message: "This date already has a decline decision." }),
        );
      }
      const now = Date.now();
      const declineId = yield* writer.table("date_declines").insert({
        organizationId: event.organizationId,
        eventId: event._id,
        eventDateId,
        registrationId,
        participantId: registration.participantId,
        status: "declined",
        declinedAt: now,
      });
      return { declineId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const overrideDateDecline = FunctionImpl.make(
  databaseSchema,
  registrations,
  "overrideDateDecline",
  ({ declineId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const decline = yield* reader
        .table("date_declines")
        .get(declineId)
        .pipe(Effect.mapError(() => new Forbidden({ message: "Decline not found." })));
      yield* requireEventAccess(decline.eventId, identity.tokenIdentifier);
      if (decline.status !== "declined") return null;
      yield* writer.table("date_declines").patch(declineId, {
        status: "reversed",
        reversedAt: Date.now(),
        reversedByIdentity: identity.tokenIdentifier,
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

export default GroupImpl.make(databaseSchema, registrations).pipe(
  Layer.provide(list),
  Layer.provide(configure),
  Layer.provide(register),
  Layer.provide(accept),
  Layer.provide(withdraw),
  Layer.provide(declineDate),
  Layer.provide(overrideDateDecline),
  GroupImpl.finalize,
);
