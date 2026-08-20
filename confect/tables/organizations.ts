import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() =>
  Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
    defaultTimezone: Schema.String,
    status: Schema.Literal("active", "archived"),
    createdByIdentity: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
).index("by_slug", ["slug"]);
