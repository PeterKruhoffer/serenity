import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventId: Id("events"),
    eventDateId: Id("event_dates"),
    registrationId: Id("registrations"),
    participantId: Id("participants"),
    status: Schema.Literal("declined", "reversed"),
    declinedAt: Schema.Number,
    reversedAt: Schema.optional(Schema.Number),
    reversedByIdentity: Schema.optional(Schema.String),
  }),
)
  .index("by_registrationId_and_eventDateId", ["registrationId", "eventDateId"])
  .index("by_eventDateId_and_status", ["eventDateId", "status"]);
