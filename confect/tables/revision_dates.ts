import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    revisionId: Id("event_revisions"),
    sourceEventDateId: Id("event_dates"),
    startsAt: Schema.Number,
    endsAt: Schema.Number,
    venueName: Schema.String,
    status: Schema.Literal("scheduled", "cancelled"),
    sortOrder: Schema.Number,
  }),
).index("by_revisionId_and_sortOrder", ["revisionId", "sortOrder"]);
