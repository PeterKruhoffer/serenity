import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    registrationId: Id("registrations"),
    revisionSignupFieldId: Id("revision_signup_fields"),
    valueType: Schema.Literal("text", "boolean", "selections"),
    textValue: Schema.optional(Schema.String),
    booleanValue: Schema.optional(Schema.Boolean),
    selectionValues: Schema.optional(Schema.Array(Schema.String)),
    createdAt: Schema.Number,
  }),
)
  .index("by_registrationId_and_revisionSignupFieldId", ["registrationId", "revisionSignupFieldId"])
  .index("by_registrationId", ["registrationId"]);
