import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter } from "./_generated/services";
import { canAccessTeam, membershipFor, requireEventAccess, requireIdentity } from "./access";
import events from "./events.spec";
import { Conflict, Forbidden, InvalidInput } from "./workspace.spec";

const getIdentity = requireIdentity("Sign in to manage events.");

const requireEvent = (eventId: GenericId<"events">, identityToken: string) =>
  requireEventAccess(eventId, identityToken).pipe(Effect.map(({ event }) => event));

const MAX_DATES_PER_EVENT = 100;
const MAX_SESSIONS_PER_DATE = 100;

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

type SignupFieldInput = {
  readonly type: "text" | "textarea" | "yes_no" | "checkboxes";
  readonly label: string;
  readonly required: boolean;
  readonly options: ReadonlyArray<string>;
  readonly section?: string;
};

const validateSignupFields = (fields: ReadonlyArray<SignupFieldInput>) =>
  Effect.gen(function* () {
    if (fields.length > 50) {
      return yield* Effect.fail(
        new InvalidInput({ message: "A sign-up form can contain at most 50 fields." }),
      );
    }
    return yield* Effect.forEach(fields, (field) =>
      Effect.gen(function* () {
        const label = yield* normalizeText(field.label, "Question", 2, 160);
        if (field.type !== "checkboxes" && field.options.length > 0) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Only checkbox fields can define options." }),
          );
        }
        if (
          field.type === "checkboxes" &&
          (field.options.length < 1 || field.options.length > 20)
        ) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Checkbox fields need between 1 and 20 options." }),
          );
        }
        const options = yield* Effect.forEach(field.options, (option) =>
          normalizeText(option, "Checkbox option", 1, 120),
        );
        if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Checkbox options must be unique." }),
          );
        }
        const section = field.section
          ? yield* normalizeText(field.section, "Section title", 2, 80)
          : undefined;
        return {
          type: field.type,
          label,
          required: field.required,
          options: [...options],
          ...(section ? { section } : {}),
        };
      }),
    );
  });

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
    const signupFields = yield* reader
      .table("signup_form_fields")
      .index("by_eventId_and_sortOrder", (q) => q.eq("eventId", eventId))
      .take(50);

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
      signupFields: signupFields.map((field) => ({
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options,
        ...(field.section === undefined ? {} : { section: field.section }),
      })),
    };
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const listSignupTemplates = FunctionImpl.make(
  databaseSchema,
  events,
  "listSignupTemplates",
  ({ organizationId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const membership = yield* membershipFor(organizationId, identity.tokenIdentifier);
      const templates = yield* reader
        .table("signup_form_templates")
        .index("by_organizationId_and_updatedAt", (q) => q.eq("organizationId", organizationId))
        .take(100);
      const assignments =
        membership.role === "event_manager"
          ? yield* reader
              .table("team_memberships")
              .index("by_organizationId_and_identityToken", (q) =>
                q
                  .eq("organizationId", organizationId)
                  .eq("identityToken", identity.tokenIdentifier),
              )
              .take(100)
          : [];
      const assignedTeamIds = new Set(assignments.map((assignment) => assignment.teamId));
      const visibleTemplates = templates.filter(
        (template) =>
          template.scope === "organization" ||
          membership.role !== "event_manager" ||
          (template.teamId !== undefined && assignedTeamIds.has(template.teamId)),
      );
      return yield* Effect.forEach(visibleTemplates, (template) =>
        Effect.gen(function* () {
          const fields = yield* reader
            .table("signup_form_fields")
            .index("by_templateId_and_sortOrder", (q) => q.eq("templateId", template._id))
            .take(50);
          return {
            id: template._id,
            ...(template.teamId === undefined ? {} : { teamId: template.teamId }),
            name: template.name,
            scope: template.scope,
            fields: fields.map((field) => ({
              type: field.type,
              label: field.label,
              required: field.required,
              options: field.options,
              ...(field.section === undefined ? {} : { section: field.section }),
            })),
          };
        }),
      );
    }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const saveSignupTemplate = FunctionImpl.make(
  databaseSchema,
  events,
  "saveSignupTemplate",
  ({ organizationId, teamId, name: rawName, scope, fields }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const membership = yield* membershipFor(organizationId, identity.tokenIdentifier);
      const name = yield* normalizeText(rawName, "Template name", 2, 80);
      const normalizedFields = yield* validateSignupFields(fields);
      if (normalizedFields.length === 0) {
        return yield* Effect.fail(
          new InvalidInput({ message: "Add at least one field before saving a template." }),
        );
      }
      if (scope === "organization" && membership.role === "event_manager") {
        return yield* Effect.fail(
          new Forbidden({
            message: "Only administrators and super users can share organization templates.",
          }),
        );
      }
      if (scope === "team") {
        if (teamId === undefined) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Choose a team for this template." }),
          );
        }
        const allowed = yield* canAccessTeam(
          membership.role,
          organizationId,
          teamId,
          identity.tokenIdentifier,
        );
        const team = yield* reader
          .table("teams")
          .get(teamId)
          .pipe(
            Effect.mapError(() => new Forbidden({ message: "The selected team is unavailable." })),
          );
        if (!allowed || team.organizationId !== organizationId || team.status !== "active") {
          return yield* Effect.fail(
            new Forbidden({ message: "The selected team is unavailable." }),
          );
        }
      }
      const now = Date.now();
      const templateId = yield* writer.table("signup_form_templates").insert({
        organizationId,
        ...(scope === "team" && teamId !== undefined ? { teamId } : {}),
        name,
        scope,
        fieldCount: normalizedFields.length,
        createdByIdentity: identity.tokenIdentifier,
        createdAt: now,
        updatedAt: now,
      });
      yield* Effect.forEach(normalizedFields, (field, sortOrder) =>
        writer.table("signup_form_fields").insert({
          organizationId,
          templateId,
          ...field,
          sortOrder,
          createdAt: now,
          updatedAt: now,
        }),
      );
      yield* writer.table("audit_entries").insert({
        organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "signup_template.created",
        entityType: "signup_form_template",
        entityId: templateId,
        summary: `Created sign-up template ${name}`,
        occurredAt: now,
      });
      return { templateId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const updateSignupTemplate = FunctionImpl.make(
  databaseSchema,
  events,
  "updateSignupTemplate",
  ({ templateId, teamId, name: rawName, scope, fields }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const template = yield* reader
        .table("signup_form_templates")
        .get(templateId)
        .pipe(Effect.mapError(() => new Forbidden({ message: "You cannot edit this template." })));
      const membership = yield* membershipFor(template.organizationId, identity.tokenIdentifier);
      if (template.scope === "organization" && membership.role === "event_manager") {
        return yield* Effect.fail(new Forbidden({ message: "You cannot edit this template." }));
      }
      if (template.teamId !== undefined) {
        const canEditCurrentTeam = yield* canAccessTeam(
          membership.role,
          template.organizationId,
          template.teamId,
          identity.tokenIdentifier,
        );
        if (!canEditCurrentTeam) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot edit this template." }));
        }
      }
      if (scope === "organization" && membership.role === "event_manager") {
        return yield* Effect.fail(
          new Forbidden({
            message: "Only administrators and super users can share organization templates.",
          }),
        );
      }
      if (scope === "team") {
        if (teamId === undefined) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Choose a team for this template." }),
          );
        }
        const allowed = yield* canAccessTeam(
          membership.role,
          template.organizationId,
          teamId,
          identity.tokenIdentifier,
        );
        const team = yield* reader
          .table("teams")
          .get(teamId)
          .pipe(
            Effect.mapError(() => new Forbidden({ message: "The selected team is unavailable." })),
          );
        if (
          !allowed ||
          team.organizationId !== template.organizationId ||
          team.status !== "active"
        ) {
          return yield* Effect.fail(
            new Forbidden({ message: "The selected team is unavailable." }),
          );
        }
      }
      const name = yield* normalizeText(rawName, "Template name", 2, 80);
      const normalizedFields = yield* validateSignupFields(fields);
      if (normalizedFields.length === 0) {
        return yield* Effect.fail(
          new InvalidInput({ message: "Add at least one field before saving a template." }),
        );
      }
      const previousFields = yield* reader
        .table("signup_form_fields")
        .index("by_templateId_and_sortOrder", (q) => q.eq("templateId", templateId))
        .take(100);
      yield* Effect.forEach(previousFields, (field) =>
        writer.table("signup_form_fields").delete(field._id),
      );
      const now = Date.now();
      yield* writer.table("signup_form_templates").replace(templateId, {
        organizationId: template.organizationId,
        ...(scope === "team" && teamId !== undefined ? { teamId } : {}),
        name,
        scope,
        fieldCount: normalizedFields.length,
        createdByIdentity: template.createdByIdentity,
        createdAt: template.createdAt,
        updatedAt: now,
      });
      yield* Effect.forEach(normalizedFields, (field, sortOrder) =>
        writer.table("signup_form_fields").insert({
          organizationId: template.organizationId,
          templateId,
          ...field,
          sortOrder,
          createdAt: now,
          updatedAt: now,
        }),
      );
      yield* writer.table("audit_entries").insert({
        organizationId: template.organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "signup_template.updated",
        entityType: "signup_form_template",
        entityId: templateId,
        summary: `Updated sign-up template ${name}`,
        occurredAt: now,
      });
      return { templateId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const deleteSignupTemplate = FunctionImpl.make(
  databaseSchema,
  events,
  "deleteSignupTemplate",
  ({ templateId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const template = yield* reader
        .table("signup_form_templates")
        .get(templateId)
        .pipe(
          Effect.mapError(() => new Forbidden({ message: "You cannot delete this template." })),
        );
      const membership = yield* membershipFor(template.organizationId, identity.tokenIdentifier);
      if (template.scope === "organization" && membership.role === "event_manager") {
        return yield* Effect.fail(new Forbidden({ message: "You cannot delete this template." }));
      }
      if (template.teamId !== undefined) {
        const allowed = yield* canAccessTeam(
          membership.role,
          template.organizationId,
          template.teamId,
          identity.tokenIdentifier,
        );
        if (!allowed) {
          return yield* Effect.fail(new Forbidden({ message: "You cannot delete this template." }));
        }
      }
      const fields = yield* reader
        .table("signup_form_fields")
        .index("by_templateId_and_sortOrder", (q) => q.eq("templateId", templateId))
        .take(100);
      yield* Effect.forEach(fields, (field) =>
        writer.table("signup_form_fields").delete(field._id),
      );
      yield* writer.table("signup_form_templates").delete(templateId);
      yield* writer.table("audit_entries").insert({
        organizationId: template.organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "signup_template.deleted",
        entityType: "signup_form_template",
        entityId: templateId,
        summary: `Deleted sign-up template ${template.name}`,
        occurredAt: Date.now(),
      });
      return { templateId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const create = FunctionImpl.make(
  databaseSchema,
  events,
  "create",
  ({ organizationId, teamId, title: rawTitle, description, timezone, dates, signupFields }) =>
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
      const normalizedTimezone = yield* normalizeText(timezone, "Timezone", 2, 80);
      if (description.length > 5_000) {
        return yield* Effect.fail(
          new InvalidInput({ message: "Description cannot exceed 5,000 characters." }),
        );
      }
      if (dates.length === 0 || dates.length > MAX_DATES_PER_EVENT) {
        return yield* Effect.fail(
          new InvalidInput({
            message: `An event must contain between 1 and ${MAX_DATES_PER_EVENT} dates.`,
          }),
        );
      }
      const normalizedDates = yield* Effect.forEach(dates, (date) =>
        Effect.gen(function* () {
          if (date.sessions.length > MAX_SESSIONS_PER_DATE) {
            return yield* Effect.fail(
              new InvalidInput({
                message: `A date can contain at most ${MAX_SESSIONS_PER_DATE} sessions.`,
              }),
            );
          }
          yield* validateDate(date.startsAt, date.endsAt);
          const venueName = yield* normalizeText(date.venueName, "Venue", 2, 120);
          const sessions = yield* Effect.forEach(date.sessions, (session) =>
            Effect.gen(function* () {
              yield* validateDate(session.startsAt, session.endsAt);
              if (session.startsAt < date.startsAt || session.endsAt > date.endsAt) {
                return yield* Effect.fail(
                  new InvalidInput({ message: "A session must fit within its event date." }),
                );
              }
              const sessionTitle = yield* normalizeText(session.title, "Session title", 2, 120);
              const roomName = session.roomName.trim();
              if (roomName.length > 120) {
                return yield* Effect.fail(
                  new InvalidInput({ message: "Room name cannot exceed 120 characters." }),
                );
              }
              return { ...session, title: sessionTitle, roomName };
            }),
          );
          return { ...date, venueName, sessions };
        }),
      );
      const normalizedSignupFields = yield* validateSignupFields(signupFields ?? []);

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
        occurrenceCount: normalizedDates.length,
        sessionCount: normalizedDates.reduce((count, date) => count + date.sessions.length, 0),
        createdByIdentity: identity.tokenIdentifier,
        createdAt: now,
        updatedAt: now,
      });
      yield* Effect.forEach(normalizedDates, (date, dateIndex) =>
        Effect.gen(function* () {
          const eventDateId = yield* writer.table("event_dates").insert({
            organizationId,
            eventId,
            startsAt: date.startsAt,
            endsAt: date.endsAt,
            venueName: date.venueName,
            status: "scheduled",
            sortOrder: dateIndex,
            createdAt: now,
            updatedAt: now,
          });
          yield* Effect.forEach(date.sessions, (session, sessionIndex) =>
            writer.table("sessions").insert({
              organizationId,
              eventId,
              eventDateId,
              title: session.title,
              startsAt: session.startsAt,
              endsAt: session.endsAt,
              roomName: session.roomName,
              sortOrder: sessionIndex,
              createdAt: now,
              updatedAt: now,
            }),
          );
        }),
      );
      yield* Effect.forEach(normalizedSignupFields, (field, sortOrder) =>
        writer.table("signup_form_fields").insert({
          organizationId,
          eventId,
          ...field,
          sortOrder,
          createdAt: now,
          updatedAt: now,
        }),
      );
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
    if (event.occurrenceCount >= MAX_DATES_PER_EVENT) {
      return yield* Effect.fail(
        new InvalidInput({ message: `An event can contain at most ${MAX_DATES_PER_EVENT} dates.` }),
      );
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
      const sessionsForDate = yield* reader
        .table("sessions")
        .index("by_eventDateId_and_sortOrder", (q) => q.eq("eventDateId", eventDateId))
        .take(MAX_SESSIONS_PER_DATE);
      if (sessionsForDate.length >= MAX_SESSIONS_PER_DATE) {
        return yield* Effect.fail(
          new InvalidInput({
            message: `A date can contain at most ${MAX_SESSIONS_PER_DATE} sessions.`,
          }),
        );
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
  Layer.provide(listSignupTemplates),
  Layer.provide(saveSignupTemplate),
  Layer.provide(updateSignupTemplate),
  Layer.provide(deleteSignupTemplate),
  Layer.provide(create),
  Layer.provide(addDate),
  Layer.provide(addSession),
  GroupImpl.finalize,
);
