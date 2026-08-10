import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    identityToken: Schema.String,
    displayName: Schema.String,
    email: Schema.optional(Schema.String),
    role: Schema.Literal("administrator", "super_user", "event_manager"),
    status: Schema.Literal("active", "suspended"),
    joinedAt: Schema.Number,
  }),
)
  .index("by_identityToken_and_status", ["identityToken", "status"])
  .index("by_organizationId_and_identityToken", ["organizationId", "identityToken"]);
