import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    teamId: Schema.optional(Id("teams")),
    name: Schema.String,
    scope: Schema.Literal("organization", "team"),
    fieldCount: Schema.Number,
    createdByIdentity: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_organizationId_and_updatedAt", ["organizationId", "updatedAt"])
  .index("by_teamId_and_updatedAt", ["teamId", "updatedAt"]);
