import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    actorIdentity: Schema.String,
    action: Schema.String,
    entityType: Schema.String,
    entityId: Schema.String,
    summary: Schema.String,
    occurredAt: Schema.Number,
  }),
).index("by_organizationId_and_occurredAt", ["organizationId", "occurredAt"]);
