import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    teamId: Id("teams"),
    identityToken: Schema.String,
    assignedAt: Schema.Number,
  }),
)
  .index("by_organizationId_and_identityToken", ["organizationId", "identityToken"])
  .index("by_teamId_and_identityToken", ["teamId", "identityToken"]);
