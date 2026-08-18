import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    revisionId: Id("event_revisions"),
    sourceSignupFieldId: Id("signup_form_fields"),
    type: Schema.Literal("text", "textarea", "yes_no", "checkboxes"),
    label: Schema.String,
    required: Schema.Boolean,
    options: Schema.Array(Schema.String),
    section: Schema.optional(Schema.String),
    sortOrder: Schema.Number,
  }),
).index("by_revisionId_and_sortOrder", ["revisionId", "sortOrder"]);
