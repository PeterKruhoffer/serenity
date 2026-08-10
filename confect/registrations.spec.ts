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

const RegistrationSummary = Schema.Struct({
  id: Id("registrations"),
  participantId: Id("participants"),
  participantName: Schema.String,
  participantEmail: Schema.optional(Schema.String),
  externalParticipantId: Schema.String,
  status: RegistrationStatus,
  paymentStatus: Schema.Literal("not_required", "unpaid", "pending", "paid", "refunded"),
  registeredAt: Schema.Number,
  declinedDateIds: Schema.Array(Id("event_dates")),
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => Schema.Struct({ eventId: Id("events") }),
      returns: () => Schema.Array(RegistrationSummary),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "configure",
      args: () =>
        Schema.Struct({
          eventId: Id("events"),
          capacity: Schema.Number,
          autoAccept: Schema.Boolean,
          waitingListEnabled: Schema.Boolean,
        }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "register",
      args: () =>
        Schema.Struct({
          eventId: Id("events"),
          externalParticipantId: Schema.String,
          displayName: Schema.String,
          email: Schema.String,
          locale: Schema.String,
          ticketName: Schema.String,
          priceMinor: Schema.Number,
          paymentStatus: Schema.Literal("not_required", "unpaid", "pending", "paid", "refunded"),
        }),
      returns: () =>
        Schema.Struct({
          registrationId: Id("registrations"),
          status: RegistrationStatus,
        }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "accept",
      args: () => Schema.Struct({ registrationId: Id("registrations") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "withdraw",
      args: () => Schema.Struct({ registrationId: Id("registrations") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "declineDate",
      args: () =>
        Schema.Struct({
          registrationId: Id("registrations"),
          eventDateId: Id("event_dates"),
        }),
      returns: () => Schema.Struct({ declineId: Id("date_declines") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "overrideDateDecline",
      args: () => Schema.Struct({ declineId: Id("date_declines") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  );
