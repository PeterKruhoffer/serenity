import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    teamId: Id("teams"),
    eventTypeVersionId: Id("event_type_versions"),
    title: Schema.String,
    slug: Schema.String,
    description: Schema.String,
    timezone: Schema.String,
    status: Schema.Literal("draft", "submitted", "published", "archived"),
    publishedRevisionId: Schema.optional(Id("event_revisions")),
    publishedVersion: Schema.optional(Schema.Number),
    capacity: Schema.optional(Schema.Number),
    autoAccept: Schema.optional(Schema.Boolean),
    waitingListEnabled: Schema.optional(Schema.Boolean),
    acceptedCount: Schema.optional(Schema.Number),
    occurrenceCount: Schema.Number,
    sessionCount: Schema.Number,
    createdByIdentity: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_status", ["status"])
  .index("by_organizationId_and_status", ["organizationId", "status"])
  .index("by_teamId_and_status", ["teamId", "status"])
  .index("by_organizationId_and_slug", ["organizationId", "slug"]);
