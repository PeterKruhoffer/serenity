import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "./_generated/schema";
import { Auth, DatabaseReader, DatabaseWriter } from "./_generated/services";
import events from "./events.spec";
import { Conflict, Forbidden, InvalidInput, Unauthenticated } from "./workspace.spec";

const getIdentity = Effect.gen(function* () {
  const auth = yield* Auth;
  return yield* auth.getUserIdentity.pipe(
    Effect.mapError(() => new Unauthenticated({ message: "Sign in to manage events." })),
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
      return yield* Effect.fail(
        new Forbidden({ message: "Your organization access is suspended." }),
      );
    }
    return membership;
  });

const canAccessTeam = (
  role: "administrator" | "super_user" | "event_manager",
  organizationId: GenericId<"organizations">,
  teamId: GenericId<"teams">,
  identityToken: string,
) =>
  Effect.gen(function* () {
    if (role !== "event_manager") return true;
    const reader = yield* DatabaseReader;
    const assignment = yield* reader
      .table("team_memberships")
      .index("by_teamId_and_identityToken", (q) =>
        q.eq("teamId", teamId).eq("identityToken", identityToken),
      )
      .first();
    return Option.isSome(assignment) && assignment.value.organizationId === organizationId;
  });

const requireEvent = (eventId: GenericId<"events">, identityToken: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const event = yield* reader
      .table("events")
      .get(eventId)
      .pipe(Effect.mapError(() => new Forbidden({ message: "You cannot access this event." })));
    const membership = yield* membershipFor(event.organizationId, identityToken);
    const allowed = yield* canAccessTeam(
      membership.role,
      event.organizationId,
      event.teamId,
      identityToken,
    );
    if (!allowed) {
      return yield* Effect.fail(new Forbidden({ message: "You cannot access this event." }));
    }
    return event;
  });

const normalizeText = (value: string, label: string, minimum: number, maximum: number) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < minimum || normalized.length > maximum) {
    return Effect.fail(
      new InvalidInput({
        message: `${label} must be between ${minimum} and ${maximum} characters.`,
      }),
    );
  }
  return Effect.succeed(normalized);
};

const validateDate = (startsAt: number, endsAt: number) => {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    return Effect.fail(new InvalidInput({ message: "The end time must be after the start time." }));
  }
  return Effect.succeed({ startsAt, endsAt });
};

const toSlug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "event";

const list = FunctionImpl.make(databaseSchema, events, "list", ({ organizationId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const membership = yield* membershipFor(organizationId, identity.tokenIdentifier);
    const allEvents = yield* reader
      .table("events")
      .index("by_organizationId_and_status", (q) => q.eq("organizationId", organizationId))
      .take(100);
    const assignments =
      membership.role === "event_manager"
        ? yield* reader
            .table("team_memberships")
            .index("by_organizationId_and_identityToken", (q) =>
              q.eq("organizationId", organizationId).eq("identityToken", identity.tokenIdentifier),
            )
            .take(100)
        : [];
    const assignedTeamIds = new Set(assignments.map((assignment) => assignment.teamId));

    const summaries = yield* Effect.forEach(allEvents, (event) =>
      Effect.gen(function* () {
        if (event.status === "archived") return null;
        if (membership.role === "event_manager" && !assignedTeamIds.has(event.teamId)) return null;
        const team = yield* reader
          .table("teams")
          .get(event.teamId)
          .pipe(
            Effect.mapError(
              () => new Forbidden({ message: "The event's owning team is unavailable." }),
            ),
          );
        return {
          id: event._id,
          teamId: event.teamId,
          teamName: team.name,
          title: event.title,
          description: event.description,
          timezone: event.timezone,
          status: event.status,
          occurrenceCount: event.occurrenceCount,
          sessionCount: event.sessionCount,
          updatedAt: event.updatedAt,
        } as const;
      }),
    );
    return summaries.filter((summary) => summary !== null);
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const get = FunctionImpl.make(databaseSchema, events, "get", ({ eventId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const event = yield* requireEvent(eventId, identity.tokenIdentifier);
    const team = yield* reader
      .table("teams")
      .get(event.teamId)
      .pipe(
        Effect.mapError(
          () => new Forbidden({ message: "The event's owning team is unavailable." }),
        ),
      );
    const dates = yield* reader
      .table("event_dates")
      .index("by_eventId_and_sortOrder", (q) => q.eq("eventId", eventId))
      .take(100);
    const datesWithSessions = yield* Effect.forEach(dates, (date) =>
      Effect.gen(function* () {
        const sessions = yield* reader
          .table("sessions")
          .index("by_eventDateId_and_sortOrder", (q) => q.eq("eventDateId", date._id))
          .take(100);
        return {
          id: date._id,
          startsAt: date.startsAt,
          endsAt: date.endsAt,
          venueName: date.venueName,
          status: date.status,
          sessions: sessions.map((session) => ({
            id: session._id,
            title: session.title,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
            roomName: session.roomName,
          })),
        } as const;
      }),
    );

    return {
      event: {
        id: event._id,
        teamId: event.teamId,
        teamName: team.name,
        title: event.title,
        description: event.description,
        timezone: event.timezone,
        status: event.status,
        occurrenceCount: event.occurrenceCount,
        sessionCount: event.sessionCount,
        updatedAt: event.updatedAt,
      },
      dates: datesWithSessions,
    };
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const create = FunctionImpl.make(
  databaseSchema,
  events,
  "create",
  ({ organizationId, teamId, title: rawTitle, description, timezone, firstDate }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const membership = yield* membershipFor(organizationId, identity.tokenIdentifier);
      const allowed = yield* canAccessTeam(
        membership.role,
        organizationId,
        teamId,
        identity.tokenIdentifier,
      );
      if (!allowed) {
        return yield* Effect.fail(
          new Forbidden({ message: "You cannot create events for this team." }),
        );
      }
      const team = yield* reader
        .table("teams")
        .get(teamId)
        .pipe(
          Effect.mapError(() => new Forbidden({ message: "The selected team is unavailable." })),
        );
      if (team.organizationId !== organizationId || team.status !== "active") {
        return yield* Effect.fail(new Forbidden({ message: "The selected team is unavailable." }));
      }

      const title = yield* normalizeText(rawTitle, "Event title", 2, 120);
      const venueName = yield* normalizeText(firstDate.venueName, "Venue", 2, 120);
      const normalizedTimezone = yield* normalizeText(timezone, "Timezone", 2, 80);
      yield* validateDate(firstDate.startsAt, firstDate.endsAt);
      if (description.length > 5_000) {
        return yield* Effect.fail(
          new InvalidInput({ message: "Description cannot exceed 5,000 characters." }),
        );
      }

      const slug = toSlug(title);
      const existingEvent = yield* reader
        .table("events")
        .index("by_organizationId_and_slug", (q) =>
          q.eq("organizationId", organizationId).eq("slug", slug),
        )
        .first();
      if (Option.isSome(existingEvent)) {
        return yield* Effect.fail(
          new Conflict({ message: "An event with that title already exists." }),
        );
      }

      const now = Date.now();
      const defaultType = yield* reader
        .table("event_types")
        .index("by_organizationId_and_slug", (q) =>
          q.eq("organizationId", organizationId).eq("slug", "standard-event"),
        )
        .first();
      const eventTypeVersionId = Option.isSome(defaultType)
        ? yield* reader
            .table("event_type_versions")
            .get(
              "by_eventTypeId_and_version",
              defaultType.value._id,
              defaultType.value.latestVersion,
            )
            .pipe(Effect.orDie)
            .pipe(Effect.map((version) => version._id))
        : yield* Effect.gen(function* () {
            const eventTypeId = yield* writer.table("event_types").insert({
              organizationId,
              name: "Standard event",
              slug: "standard-event",
              status: "active",
              latestVersion: 1,
              createdAt: now,
              updatedAt: now,
            });
            return yield* writer.table("event_type_versions").insert({
              organizationId,
              eventTypeId,
              version: 1,
              hasOccurrences: true,
              hasSessions: true,
              hasRegistration: true,
              createdAt: now,
            });
          });

      const eventId = yield* writer.table("events").insert({
        organizationId,
        teamId,
        eventTypeVersionId,
        title,
        slug,
        description: description.trim(),
        timezone: normalizedTimezone,
        status: "draft",
        capacity: 40,
        autoAccept: false,
        waitingListEnabled: true,
        acceptedCount: 0,
        occurrenceCount: 1,
        sessionCount: 0,
        createdByIdentity: identity.tokenIdentifier,
        createdAt: now,
        updatedAt: now,
      });
      yield* writer.table("event_dates").insert({
        organizationId,
        eventId,
        startsAt: firstDate.startsAt,
        endsAt: firstDate.endsAt,
        venueName,
        status: "scheduled",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      yield* writer.table("audit_entries").insert({
        organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "event.created",
        entityType: "event",
        entityId: eventId,
        summary: `Created ${title} for ${team.name}`,
        occurredAt: now,
      });
      return { eventId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const addDate = FunctionImpl.make(databaseSchema, events, "addDate", ({ eventId, date }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const writer = yield* DatabaseWriter;
    const event = yield* requireEvent(eventId, identity.tokenIdentifier);
    if (event.status !== "draft") {
      return yield* Effect.fail(new Conflict({ message: "Only draft events can be edited." }));
    }
    yield* validateDate(date.startsAt, date.endsAt);
    const venueName = yield* normalizeText(date.venueName, "Venue", 2, 120);
    const now = Date.now();
    const eventDateId = yield* writer.table("event_dates").insert({
      organizationId: event.organizationId,
      eventId,
      startsAt: date.startsAt,
      endsAt: date.endsAt,
      venueName,
      status: "scheduled",
      sortOrder: event.occurrenceCount,
      createdAt: now,
      updatedAt: now,
    });
    yield* writer.table("events").patch(eventId, {
      occurrenceCount: event.occurrenceCount + 1,
      updatedAt: now,
    });
    yield* writer.table("audit_entries").insert({
      organizationId: event.organizationId,
      actorIdentity: identity.tokenIdentifier,
      action: "event.date_added",
      entityType: "event_date",
      entityId: eventDateId,
      summary: `Added a date to ${event.title}`,
      occurredAt: now,
    });
    return { eventDateId };
  }).pipe(
    Effect.catchTags({
      DocumentDecodeError: (error) => Effect.die(error),
      DocumentEncodeError: (error) => Effect.die(error),
      GetByIdFailure: (error) => Effect.die(error),
    }),
  ),
);

const addSession = FunctionImpl.make(
  databaseSchema,
  events,
  "addSession",
  ({ eventDateId, title: rawTitle, startsAt, endsAt, roomName }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const date = yield* reader
        .table("event_dates")
        .get(eventDateId)
        .pipe(Effect.mapError(() => new Forbidden({ message: "You cannot access this date." })));
      const event = yield* requireEvent(date.eventId, identity.tokenIdentifier);
      if (event.status !== "draft") {
        return yield* Effect.fail(new Conflict({ message: "Only draft events can be edited." }));
      }
      yield* validateDate(startsAt, endsAt);
      if (startsAt < date.startsAt || endsAt > date.endsAt) {
        return yield* Effect.fail(
          new InvalidInput({ message: "A session must fit within its event date." }),
        );
      }
      const title = yield* normalizeText(rawTitle, "Session title", 2, 120);
      const normalizedRoom = roomName.trim();
      if (normalizedRoom.length > 120) {
        return yield* Effect.fail(
          new InvalidInput({ message: "Room name cannot exceed 120 characters." }),
        );
      }
      const now = Date.now();
      const sessionId = yield* writer.table("sessions").insert({
        organizationId: event.organizationId,
        eventId: event._id,
        eventDateId,
        title,
        startsAt,
        endsAt,
        roomName: normalizedRoom,
        sortOrder: event.sessionCount,
        createdAt: now,
        updatedAt: now,
      });
      yield* writer.table("events").patch(event._id, {
        sessionCount: event.sessionCount + 1,
        updatedAt: now,
      });
      yield* writer.table("audit_entries").insert({
        organizationId: event.organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "event.session_added",
        entityType: "session",
        entityId: sessionId,
        summary: `Added ${title} to ${event.title}`,
        occurredAt: now,
      });
      return { sessionId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
        GetByIdFailure: (error) => Effect.die(error),
      }),
    ),
);

export default GroupImpl.make(databaseSchema, events).pipe(
  Layer.provide(list),
  Layer.provide(get),
  Layer.provide(create),
  Layer.provide(addDate),
  Layer.provide(addSession),
  GroupImpl.finalize,
);
