import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventId: Id("events"),
    teamId: Id("teams"),
    eventTypeVersionId: Id("event_type_versions"),
    revisionNumber: Schema.Number,
    status: Schema.Literal("submitted", "approved", "rejected"),
    title: Schema.String,
    slug: Schema.String,
    description: Schema.String,
    timezone: Schema.String,
    occurrenceCount: Schema.Number,
    sessionCount: Schema.Number,
    submittedByIdentity: Schema.String,
    submittedAt: Schema.Number,
    reviewedByIdentity: Schema.optional(Schema.String),
    reviewedAt: Schema.optional(Schema.Number),
    reviewNote: Schema.optional(Schema.String),
    publishedVersion: Schema.optional(Schema.Number),
  }),
)
  .index("by_organizationId_and_status", ["organizationId", "status"])
  .index("by_eventId_and_status", ["eventId", "status"])
  .index("by_eventId_and_revisionNumber", ["eventId", "revisionNumber"]);
