import { FunctionImpl, GroupImpl } from "@confect/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import attendee from "./attendee.spec";
import { components } from "../convex/_generated/api";
import type { DataModel, Doc, Id } from "../convex/_generated/dataModel";
import databaseSchema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import { InvalidInput } from "./workspace.spec";

const signupRateLimiter = new RateLimiter(components.rateLimiter, {
  publicRegistrationByAttendee: { kind: "fixed window", rate: 5, period: MINUTE },
  publicRegistrationByEvent: { kind: "fixed window", rate: 100, period: MINUTE },
});

const MAX_DATES_PER_EVENT = 100;
const MAX_SESSIONS_PER_DATE = 100;
const MAX_ATTENDEE_ORGANIZATIONS = 100;
const MAX_REGISTRATIONS_PER_ORGANIZATION = 100;

type ReadCtx =
  | Pick<GenericQueryCtx<DataModel>, "auth" | "db">
  | Pick<GenericMutationCtx<DataModel>, "auth" | "db">;

type PublicEvent = {
  id: Id<"events">;
  organizationName: string;
  teamName: string;
  title: string;
  description: string;
  timezone: string;
  version: number;
  capacity: number;
  acceptedCount: number;
  waitingListEnabled: boolean;
  registrationState: "open" | "waitlist" | "full";
  signupFields: Array<{
    id: Id<"revision_signup_fields">;
    type: "text" | "textarea" | "yes_no" | "checkboxes";
    label: string;
    required: boolean;
    options: Array<string>;
    section?: string;
  }>;
  dates: Array<{
    id: Id<"revision_dates">;
    startsAt: number;
    endsAt: number;
    venueName: string;
    status: "scheduled" | "cancelled";
    sessions: Array<{
      title: string;
      startsAt: number;
      endsAt: number;
      roomName: string;
    }>;
  }>;
};

type SignupAnswerInput = {
  fieldId: Id<"revision_signup_fields">;
  value: string | boolean | ReadonlyArray<string>;
};

type ValidatedSignupAnswer =
  | { fieldId: Id<"revision_signup_fields">; valueType: "text"; textValue: string }
  | { fieldId: Id<"revision_signup_fields">; valueType: "boolean"; booleanValue: boolean }
  | {
      fieldId: Id<"revision_signup_fields">;
      valueType: "selections";
      selectionValues: string[];
    };

const normalize = (value: string, label: string, maximum: number) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  }
  return normalized;
};

const externalIdFor = async (ctx: ReadCtx, attendeeKey: string) => {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return `serenity-user:${identity.tokenIdentifier}`;
  if (!/^[a-f0-9]{64}$/.test(attendeeKey)) {
    throw new Error("The attendee session is invalid.");
  }
  return `serenity-attendee:${attendeeKey}`;
};

const normalizedEmail = (email?: string) => {
  const value = email?.trim().toLowerCase();
  if (!value) return undefined;
  if (value.length > 254 || !/^\S+@\S+\.\S+$/.test(value)) {
    throw new Error("Enter a valid email address.");
  }
  return value;
};

const registrationState = (event: Doc<"events">): PublicEvent["registrationState"] => {
  const acceptedCount = event.acceptedCount ?? 0;
  const capacity = event.capacity ?? 40;
  if (acceptedCount < capacity) return "open";
  return event.waitingListEnabled ? "waitlist" : "full";
};

const validateSignupAnswers = async (
  ctx: Pick<GenericMutationCtx<DataModel>, "db">,
  revisionId: Id<"event_revisions">,
  answers: ReadonlyArray<SignupAnswerInput>,
) => {
  const fields = await ctx.db
    .query("revision_signup_fields")
    .withIndex("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revisionId))
    .take(50);
  const fieldsById = new Map(fields.map((field) => [field._id, field]));
  const answersByFieldId = new Map<Id<"revision_signup_fields">, SignupAnswerInput>();
  for (const answer of answers) {
    if (answersByFieldId.has(answer.fieldId)) {
      throw new Error("Each sign-up question can only be answered once.");
    }
    if (!fieldsById.has(answer.fieldId)) {
      throw new Error("A sign-up answer does not belong to the published form.");
    }
    answersByFieldId.set(answer.fieldId, answer);
  }

  const validated: ValidatedSignupAnswer[] = [];
  for (const field of fields) {
    const answer = answersByFieldId.get(field._id);
    if (!answer) {
      if (field.required) throw new Error(`${field.label} is required.`);
      continue;
    }
    if (field.type === "text" || field.type === "textarea") {
      if (typeof answer.value !== "string") {
        throw new Error(`${field.label} must be a text answer.`);
      }
      const value = answer.value.trim();
      if (field.required && !value) throw new Error(`${field.label} is required.`);
      const maximum = field.type === "text" ? 500 : 5_000;
      if (value.length > maximum) {
        throw new Error(`${field.label} cannot exceed ${maximum.toLocaleString()} characters.`);
      }
      if (value) validated.push({ fieldId: field._id, valueType: "text", textValue: value });
      continue;
    }
    if (field.type === "yes_no") {
      if (typeof answer.value !== "boolean") {
        throw new Error(`${field.label} must be answered yes or no.`);
      }
      validated.push({ fieldId: field._id, valueType: "boolean", booleanValue: answer.value });
      continue;
    }
    if (!Array.isArray(answer.value) || !answer.value.every((value) => typeof value === "string")) {
      throw new Error(`${field.label} must be answered with a list of choices.`);
    }
    const values = [...new Set(answer.value)];
    if (field.required && values.length === 0) throw new Error(`${field.label} is required.`);
    if (values.some((value) => !field.options.includes(value))) {
      throw new Error(`${field.label} contains an invalid choice.`);
    }
    if (values.length > 0) {
      validated.push({ fieldId: field._id, valueType: "selections", selectionValues: values });
    }
  }
  return validated;
};

const readPublicEvent = async (ctx: ReadCtx, event: Doc<"events">): Promise<PublicEvent | null> => {
  if (!event.publishedRevisionId || event.status === "archived") return null;

  const [revision, organization, team] = await Promise.all([
    ctx.db.get(event.publishedRevisionId),
    ctx.db.get(event.organizationId),
    ctx.db.get(event.teamId),
  ]);
  if (!revision || revision.status !== "approved" || !organization || !team) return null;

  const revisionDates = await ctx.db
    .query("revision_dates")
    .withIndex("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revision._id))
    .take(MAX_DATES_PER_EVENT);
  const dates = await Promise.all(
    revisionDates.map(async (date) => {
      const sessions = await ctx.db
        .query("revision_sessions")
        .withIndex("by_revisionDateId_and_sortOrder", (q) => q.eq("revisionDateId", date._id))
        .take(MAX_SESSIONS_PER_DATE);
      return {
        id: date._id,
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
  const signupFields = await ctx.db
    .query("revision_signup_fields")
    .withIndex("by_revisionId_and_sortOrder", (q) => q.eq("revisionId", revision._id))
    .take(50);

  return {
    id: event._id,
    organizationName: organization.name,
    teamName: team.name,
    title: revision.title,
    description: revision.description,
    timezone: revision.timezone,
    version: revision.publishedVersion ?? event.publishedVersion ?? revision.revisionNumber,
    capacity: revision.capacity,
    acceptedCount: event.acceptedCount ?? 0,
    waitingListEnabled: revision.waitingListEnabled,
    registrationState: registrationState(event),
    dates,
    signupFields: signupFields.map((field) => ({
      id: field._id,
      type: field.type,
      label: field.label,
      required: field.required,
      options: field.options,
      ...(field.section === undefined ? {} : { section: field.section }),
    })),
  };
};

const messageFrom = (error: unknown) =>
  error instanceof Error ? error.message : "The attendee request could not be completed.";

const attempt = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (error) => new InvalidInput({ message: messageFrom(error) }),
  });

const listEvents = FunctionImpl.make(databaseSchema, attendee, "listEvents", ({ paginationOpts }) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx;
    return yield* attempt(async () => {
      const result = await ctx.db
        .query("events")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .paginate(paginationOpts);
      const visible = await Promise.all(result.page.map((event) => readPublicEvent(ctx, event)));
      return {
        ...result,
        page: visible.filter((event): event is PublicEvent => event !== null),
      };
    });
  }),
);

const getEvent = FunctionImpl.make(databaseSchema, attendee, "getEvent", ({ eventId }) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx;
    return yield* attempt(async () => {
      const event = await ctx.db.get(eventId);
      return event ? await readPublicEvent(ctx, event) : null;
    });
  }),
);

const listMine = FunctionImpl.make(databaseSchema, attendee, "listMine", ({ attendeeKey }) =>
  Effect.gen(function* () {
    const ctx = yield* QueryCtx;
    return yield* attempt(async () => {
      const externalId = await externalIdFor(ctx, attendeeKey);
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
        .take(MAX_ATTENDEE_ORGANIZATIONS);
      const registrations = (
        await Promise.all(
          participants.map((participant) =>
            ctx.db
              .query("registrations")
              .withIndex("by_participantId_and_updatedAt", (q) =>
                q.eq("participantId", participant._id),
              )
              .order("desc")
              .take(MAX_REGISTRATIONS_PER_ORGANIZATION),
          ),
        )
      ).flat();
      const hydrated = await Promise.all(
        registrations.map(async (registration) => {
          const event = await ctx.db.get(registration.eventId);
          const publicDetails = event ? await readPublicEvent(ctx, event) : null;
          if (!publicDetails) return null;
          return {
            id: registration._id,
            status: registration.status,
            registeredAt: registration.registeredAt,
            updatedAt: registration.updatedAt,
            event: publicDetails,
          };
        }),
      );
      return hydrated
        .filter((registration): registration is NonNullable<typeof registration> =>
          Boolean(registration),
        )
        .sort((left, right) => right.updatedAt - left.updatedAt);
    });
  }),
);

const statusForNewRegistration = (event: Doc<"events">) => {
  const acceptedCount = event.acceptedCount ?? 0;
  const capacity = event.capacity ?? 40;
  if (!event.autoAccept) return "pending" as const;
  if (acceptedCount < capacity) return "accepted" as const;
  if (event.waitingListEnabled) return "waitlisted" as const;
  throw new Error("This event is at capacity.");
};

const register = FunctionImpl.make(
  databaseSchema,
  attendee,
  "register",
  ({
    attendeeKey,
    eventId,
    displayName: rawDisplayName,
    email: rawEmail,
    locale: rawLocale,
    answers,
  }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      return yield* attempt(async () => {
        const externalId = await externalIdFor(ctx, attendeeKey);
        await signupRateLimiter.limit(ctx, "publicRegistrationByAttendee", {
          key: `${eventId}:${externalId}`,
          throws: true,
        });
        await signupRateLimiter.limit(ctx, "publicRegistrationByEvent", {
          key: eventId,
          throws: true,
        });
        const displayName = normalize(rawDisplayName, "Name", 100);
        const email = normalizedEmail(rawEmail);
        const locale = rawLocale?.trim().slice(0, 35) || undefined;
        const event = await ctx.db.get(eventId);
        if (!event || !event.publishedRevisionId || event.status === "archived") {
          throw new Error("This event is not open for registration.");
        }
        const revision = await ctx.db.get(event.publishedRevisionId);
        if (!revision || revision.status !== "approved") {
          throw new Error("This event is not open for registration.");
        }
        const validatedAnswers = await validateSignupAnswers(ctx, revision._id, answers ?? []);

        const now = Date.now();
        const participant = await ctx.db
          .query("participants")
          .withIndex("by_organizationId_and_externalId", (q) =>
            q.eq("organizationId", event.organizationId).eq("externalId", externalId),
          )
          .unique();
        const participantId = participant
          ? participant._id
          : await ctx.db.insert("participants", {
              organizationId: event.organizationId,
              externalId,
              displayName,
              ...(email ? { email } : {}),
              ...(locale ? { locale } : {}),
              synchronizedAt: now,
            });
        if (participant) {
          await ctx.db.patch(participant._id, {
            displayName,
            ...(email ? { email } : {}),
            ...(locale ? { locale } : {}),
            synchronizedAt: now,
          });
        }

        const existing = await ctx.db
          .query("registrations")
          .withIndex("by_eventId_and_participantId", (q) =>
            q.eq("eventId", event._id).eq("participantId", participantId),
          )
          .unique();
        if (existing && existing.status !== "withdrawn") {
          return { registrationId: existing._id, status: existing.status };
        }

        const status = statusForNewRegistration(event);
        const registrationId = existing
          ? existing._id
          : await ctx.db.insert("registrations", {
              organizationId: event.organizationId,
              eventId: event._id,
              participantId,
              status,
              ticketName: "Standard",
              priceMinor: 0,
              paymentStatus: "not_required",
              registeredAt: now,
              updatedAt: now,
              ...(status === "accepted" ? { acceptedAt: now } : {}),
            });
        if (existing) {
          await ctx.db.patch(existing._id, {
            status,
            registeredAt: now,
            updatedAt: now,
            withdrawnAt: undefined,
            acceptedAt: status === "accepted" ? now : undefined,
          });
          const previousAnswers = await ctx.db
            .query("registration_answers")
            .withIndex("by_registrationId", (q) => q.eq("registrationId", existing._id))
            .take(50);
          await Promise.all(previousAnswers.map((answer) => ctx.db.delete(answer._id)));
        }
        await Promise.all(
          validatedAnswers.map((answer) =>
            ctx.db.insert("registration_answers", {
              organizationId: event.organizationId,
              registrationId,
              revisionSignupFieldId: answer.fieldId,
              valueType: answer.valueType,
              ...(answer.valueType === "text" ? { textValue: answer.textValue } : {}),
              ...(answer.valueType === "boolean" ? { booleanValue: answer.booleanValue } : {}),
              ...(answer.valueType === "selections"
                ? { selectionValues: answer.selectionValues }
                : {}),
              createdAt: now,
            }),
          ),
        );
        if (status === "accepted") {
          await ctx.db.patch(event._id, {
            acceptedCount: (event.acceptedCount ?? 0) + 1,
            updatedAt: now,
          });
        }
        await ctx.db.insert("audit_entries", {
          organizationId: event.organizationId,
          actorIdentity: externalId,
          action: "attendee.registration_created",
          entityType: "registration",
          entityId: registrationId,
          summary: `Registered ${displayName} for ${revision.title} as ${status}`,
          occurredAt: now,
        });
        return { registrationId, status };
      });
    }),
);

const withdraw = FunctionImpl.make(
  databaseSchema,
  attendee,
  "withdraw",
  ({ attendeeKey, registrationId }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      return yield* attempt(async () => {
        const externalId = await externalIdFor(ctx, attendeeKey);
        const registration = await ctx.db.get(registrationId);
        if (!registration) throw new Error("Registration not found.");
        const participant = await ctx.db.get(registration.participantId);
        if (!participant || participant.externalId !== externalId) {
          throw new Error("Registration not found.");
        }
        if (registration.status === "withdrawn") return null;

        const event = await ctx.db.get(registration.eventId);
        if (!event) throw new Error("Event not found.");
        const now = Date.now();
        await ctx.db.patch(registration._id, {
          status: "withdrawn",
          withdrawnAt: now,
          updatedAt: now,
        });
        if (registration.status === "accepted") {
          const next = await ctx.db
            .query("registrations")
            .withIndex("by_eventId_and_status", (q) =>
              q.eq("eventId", event._id).eq("status", "waitlisted"),
            )
            .first();
          if (next && event.autoAccept) {
            await ctx.db.patch(next._id, {
              status: "accepted",
              acceptedAt: now,
              updatedAt: now,
            });
          }
          await ctx.db.patch(event._id, {
            acceptedCount:
              next && event.autoAccept
                ? (event.acceptedCount ?? 1)
                : Math.max(0, (event.acceptedCount ?? 1) - 1),
            updatedAt: now,
          });
        }
        await ctx.db.insert("audit_entries", {
          organizationId: event.organizationId,
          actorIdentity: externalId,
          action: "attendee.registration_withdrawn",
          entityType: "registration",
          entityId: registration._id,
          summary: "Attendee withdrew their registration",
          occurredAt: now,
        });
        return null;
      });
    }),
);

export default GroupImpl.make(databaseSchema, attendee).pipe(
  Layer.provide(listEvents),
  Layer.provide(getEvent),
  Layer.provide(listMine),
  Layer.provide(register),
  Layer.provide(withdraw),
  GroupImpl.finalize,
);
