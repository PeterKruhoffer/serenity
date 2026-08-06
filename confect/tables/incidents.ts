import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    name: Schema.String,
    summary: Schema.String,
    region: Schema.String,
    severity: Schema.Literal("critical", "high", "medium"),
    status: Schema.Literal("active", "investigating", "contained"),
    updatedAt: Schema.Number,
  }),
);
