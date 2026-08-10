import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventTypeId: Id("event_types"),
    version: Schema.Number,
    hasOccurrences: Schema.Boolean,
    hasSessions: Schema.Boolean,
    hasRegistration: Schema.Boolean,
    createdAt: Schema.Number,
  }),
).index("by_eventTypeId_and_version", ["eventTypeId", "version"]);
