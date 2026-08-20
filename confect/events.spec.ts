import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";
import { WorkspaceError } from "./workspace.spec";

const EventStatus = Schema.Literal("draft", "submitted", "published", "archived");

const EventSummary = Schema.Struct({
  id: Id("events"),
  teamId: Id("teams"),
  teamName: Schema.String,
  title: Schema.String,
  description: Schema.String,
  timezone: Schema.String,
  status: EventStatus,
  occurrenceCount: Schema.Number,
  sessionCount: Schema.Number,
  updatedAt: Schema.Number,
});

const SessionSummary = Schema.Struct({
  id: Id("sessions"),
  title: Schema.String,
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  roomName: Schema.String,
});

const DateSummary = Schema.Struct({
  id: Id("event_dates"),
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  venueName: Schema.String,
  status: Schema.Literal("scheduled", "cancelled"),
  sessions: Schema.Array(SessionSummary),
});

const CalendarOccurrence = Schema.Struct({
  id: Id("event_dates"),
  eventId: Id("events"),
  eventTitle: Schema.String,
  eventStatus: EventStatus,
  eventTimezone: Schema.String,
  teamId: Id("teams"),
  teamName: Schema.String,
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  occurrenceStatus: Schema.Literal("scheduled", "cancelled"),
  venueName: Schema.String,
});

const SignupField = Schema.Struct({
  type: Schema.Literal("text", "textarea", "yes_no", "checkboxes"),
  label: Schema.String,
  required: Schema.Boolean,
  options: Schema.Array(Schema.String),
  section: Schema.optional(Schema.String),
});

const EventDetail = Schema.Struct({
  event: EventSummary,
  dates: Schema.Array(DateSummary),
  signupFields: Schema.Array(SignupField),
});

const SessionInput = Schema.Struct({
  title: Schema.String,
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  roomName: Schema.String,
});

const DateInput = Schema.Struct({
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  venueName: Schema.String,
  sessions: Schema.Array(SessionInput),
});

const SignupTemplate = Schema.Struct({
  id: Id("signup_form_templates"),
  teamId: Schema.optional(Id("teams")),
  name: Schema.String,
  scope: Schema.Literal("organization", "team"),
  fields: Schema.Array(SignupField),
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => Schema.Struct({ organizationId: Id("organizations") }),
      returns: () => Schema.Array(EventSummary),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => Schema.Struct({ eventId: Id("events") }),
      returns: () => EventDetail,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listCalendarOccurrences",
      args: () =>
        Schema.Struct({
          organizationId: Id("organizations"),
          rangeStart: Schema.Number,
          rangeEnd: Schema.Number,
          teamId: Schema.optional(Id("teams")),
        }),
      returns: () => Schema.Array(CalendarOccurrence),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () =>
        Schema.Struct({
          organizationId: Id("organizations"),
          teamId: Id("teams"),
          title: Schema.String,
          description: Schema.String,
          timezone: Schema.String,
          dates: Schema.Array(DateInput),
          signupFields: Schema.optional(Schema.Array(SignupField)),
        }),
      returns: () => Schema.Struct({ eventId: Id("events") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listSignupTemplates",
      args: () => Schema.Struct({ organizationId: Id("organizations") }),
      returns: () => Schema.Array(SignupTemplate),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "saveSignupTemplate",
      args: () =>
        Schema.Struct({
          organizationId: Id("organizations"),
          teamId: Schema.optional(Id("teams")),
          name: Schema.String,
          scope: Schema.Literal("organization", "team"),
          fields: Schema.Array(SignupField),
        }),
      returns: () => Schema.Struct({ templateId: Id("signup_form_templates") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateSignupTemplate",
      args: () =>
        Schema.Struct({
          templateId: Id("signup_form_templates"),
          teamId: Schema.optional(Id("teams")),
          name: Schema.String,
          scope: Schema.Literal("organization", "team"),
          fields: Schema.Array(SignupField),
        }),
      returns: () => Schema.Struct({ templateId: Id("signup_form_templates") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteSignupTemplate",
      args: () => Schema.Struct({ templateId: Id("signup_form_templates") }),
      returns: () => Schema.Struct({ templateId: Id("signup_form_templates") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addDate",
      args: () =>
        Schema.Struct({
          eventId: Id("events"),
          date: DateInput.omit("sessions"),
        }),
      returns: () => Schema.Struct({ eventDateId: Id("event_dates") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addSession",
      args: () =>
        Schema.Struct({
          eventDateId: Id("event_dates"),
          title: Schema.String,
          startsAt: Schema.Number,
          endsAt: Schema.Number,
          roomName: Schema.String,
        }),
      returns: () => Schema.Struct({ sessionId: Id("sessions") }),
      error: () => WorkspaceError,
    }),
  );
