import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";
import { WorkspaceError } from "./workspace.spec";

const RegistrationStatus = Schema.Literal(
  "pending",
  "accepted",
  "waitlisted",
  "rejected",
  "withdrawn",
);

const PublicSession = Schema.Struct({
  title: Schema.String,
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  roomName: Schema.String,
});

const PublicDate = Schema.Struct({
  id: Id("revision_dates"),
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  venueName: Schema.String,
  status: Schema.Literal("scheduled", "cancelled"),
  sessions: Schema.Array(PublicSession),
});

const PublicSignupField = Schema.Struct({
  id: Id("revision_signup_fields"),
  type: Schema.Literal("text", "textarea", "yes_no", "checkboxes"),
  label: Schema.String,
  required: Schema.Boolean,
  options: Schema.Array(Schema.String),
  section: Schema.optional(Schema.String),
});

const SignupAnswer = Schema.Struct({
  fieldId: Id("revision_signup_fields"),
  value: Schema.Union(Schema.String, Schema.Boolean, Schema.Array(Schema.String)),
});

const PublicEvent = Schema.Struct({
  id: Id("events"),
  organizationName: Schema.String,
  teamName: Schema.String,
  title: Schema.String,
  description: Schema.String,
  timezone: Schema.String,
  version: Schema.Number,
  capacity: Schema.Number,
  acceptedCount: Schema.Number,
  waitingListEnabled: Schema.Boolean,
  registrationState: Schema.Literal("open", "waitlist", "full"),
  dates: Schema.Array(PublicDate),
  signupFields: Schema.Array(PublicSignupField),
});

const MyRegistration = Schema.Struct({
  id: Id("registrations"),
  status: RegistrationStatus,
  registeredAt: Schema.Number,
  updatedAt: Schema.Number,
  event: PublicEvent,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "listEvents",
      item: () => PublicEvent,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getEvent",
      args: () => Schema.Struct({ eventId: Id("events") }),
      returns: () => Schema.Union(PublicEvent, Schema.Null),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listMine",
      args: () => Schema.Struct({ attendeeKey: Schema.String }),
      returns: () => Schema.Array(MyRegistration),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "register",
      args: () =>
        Schema.Struct({
          attendeeKey: Schema.String,
          eventId: Id("events"),
          displayName: Schema.String,
          email: Schema.optional(Schema.String),
          locale: Schema.optional(Schema.String),
          answers: Schema.optional(Schema.Array(SignupAnswer)),
        }),
      returns: () =>
        Schema.Struct({ registrationId: Id("registrations"), status: RegistrationStatus }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "withdraw",
      args: () =>
        Schema.Struct({ attendeeKey: Schema.String, registrationId: Id("registrations") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  );
