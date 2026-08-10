import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    revisionId: Id("event_revisions"),
    revisionDateId: Id("revision_dates"),
    sourceSessionId: Id("sessions"),
    title: Schema.String,
    startsAt: Schema.Number,
    endsAt: Schema.Number,
    roomName: Schema.String,
    sortOrder: Schema.Number,
  }),
).index("by_revisionDateId_and_sortOrder", ["revisionDateId", "sortOrder"]);
