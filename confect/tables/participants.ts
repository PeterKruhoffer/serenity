import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    externalId: Schema.String,
    displayName: Schema.String,
    email: Schema.optional(Schema.String),
    locale: Schema.optional(Schema.String),
    synchronizedAt: Schema.Number,
  }),
).index("by_organizationId_and_externalId", ["organizationId", "externalId"]);
