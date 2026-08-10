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
    occurrenceCount: Schema.Number,
    sessionCount: Schema.Number,
    createdByIdentity: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_organizationId_and_status", ["organizationId", "status"])
  .index("by_teamId_and_status", ["teamId", "status"])
  .index("by_organizationId_and_slug", ["organizationId", "slug"]);
