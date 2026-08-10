import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventId: Id("events"),
    eventDateId: Id("event_dates"),
    title: Schema.String,
    startsAt: Schema.Number,
    endsAt: Schema.Number,
    roomName: Schema.String,
    sortOrder: Schema.Number,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
).index("by_eventDateId_and_sortOrder", ["eventDateId", "sortOrder"]);
