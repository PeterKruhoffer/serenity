import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventId: Id("events"),
    startsAt: Schema.Number,
    endsAt: Schema.Number,
    venueName: Schema.String,
    status: Schema.Literal("scheduled", "cancelled"),
    sortOrder: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
).index("by_eventId_and_sortOrder", ["eventId", "sortOrder"]);
