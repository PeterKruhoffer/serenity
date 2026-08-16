import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventId: Schema.optional(Id("events")),
    templateId: Schema.optional(Id("signup_form_templates")),
    type: Schema.Literal("text", "textarea", "yes_no", "checkboxes"),
    label: Schema.String,
    required: Schema.Boolean,
    options: Schema.Array(Schema.String),
    sortOrder: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_eventId_and_sortOrder", ["eventId", "sortOrder"])
  .index("by_templateId_and_sortOrder", ["templateId", "sortOrder"]);
