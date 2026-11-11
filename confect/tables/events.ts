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
    topic: Schema.optional(Schema.String),
    topicId: Schema.optional(Id("event_topics")),
    // The template whose fields lead this event's sign-up form. Read live, never copied.
    signupTemplateId: Schema.optional(Id("signup_form_templates")),
    timezone: Schema.String,
    status: Schema.Literal("draft", "submitted", "published", "archived"),
    publishedRevisionId: Schema.optional(Id("event_revisions")),
    publishedVersion: Schema.optional(Schema.Number),
    // True while attendees can discover the published snapshot, independent of draft/review status.
    isPubliclyListed: Schema.optional(Schema.Boolean),
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
  .index("by_isPubliclyListed", ["isPubliclyListed"])
  .index("by_signupTemplateId", ["signupTemplateId"])
  .index("by_organizationId_and_status", ["organizationId", "status"])
  .index("by_teamId_and_status", ["teamId", "status"])
  .index("by_organizationId_and_slug", ["organizationId", "slug"]);
