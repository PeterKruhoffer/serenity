import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";
import { WorkspaceError } from "./workspace.spec";

const PendingRevision = Schema.Struct({
  id: Id("event_revisions"),
  eventId: Id("events"),
  revisionNumber: Schema.Number,
  title: Schema.String,
  teamName: Schema.String,
  occurrenceCount: Schema.Number,
  sessionCount: Schema.Number,
  submittedAt: Schema.Number,
});

const PublishedSession = Schema.Struct({
  title: Schema.String,
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  roomName: Schema.String,
});

const PublishedDate = Schema.Struct({
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  venueName: Schema.String,
  status: Schema.Literal("scheduled", "cancelled"),
  sessions: Schema.Array(PublishedSession),
});

const PublishedEvent = Schema.Struct({
  eventId: Id("events"),
  revisionId: Id("event_revisions"),
  version: Schema.Number,
  title: Schema.String,
  description: Schema.String,
  timezone: Schema.String,
  dates: Schema.Array(PublishedDate),
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listPending",
      args: () => Schema.Struct({ organizationId: Id("organizations") }),
      returns: () => Schema.Array(PendingRevision),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getPublished",
      args: () => Schema.Struct({ eventId: Id("events") }),
      returns: () => PublishedEvent,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "submit",
      args: () => Schema.Struct({ eventId: Id("events") }),
      returns: () => Schema.Struct({ revisionId: Id("event_revisions") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "approve",
      args: () => Schema.Struct({ revisionId: Id("event_revisions"), note: Schema.String }),
      returns: () => Schema.Struct({ publishedVersion: Schema.Number }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reject",
      args: () => Schema.Struct({ revisionId: Id("event_revisions"), note: Schema.String }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startDraft",
      args: () => Schema.Struct({ eventId: Id("events") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  );
