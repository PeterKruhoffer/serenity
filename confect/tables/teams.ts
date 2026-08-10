import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    name: Schema.String,
    slug: Schema.String,
    status: Schema.Literal("active", "archived"),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_organizationId_and_status", ["organizationId", "status"])
  .index("by_organizationId_and_slug", ["organizationId", "slug"]);
