import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    type: Schema.String,
    apiVersion: Schema.String,
    subjectType: Schema.String,
    subjectId: Schema.String,
    data: Schema.String,
    occurredAt: Schema.Number,
  }),
)
  .index("by_organizationId_and_occurredAt", ["organizationId", "occurredAt"])
  .index("by_subjectType_and_subjectId", ["subjectType", "subjectId"]);
