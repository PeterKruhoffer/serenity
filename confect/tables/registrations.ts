import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    eventId: Id("events"),
    participantId: Id("participants"),
    status: Schema.Literal("pending", "accepted", "waitlisted", "rejected", "withdrawn"),
    ticketName: Schema.String,
    priceMinor: Schema.Number,
    paymentStatus: Schema.Literal("not_required", "unpaid", "pending", "paid", "refunded"),
    externalPaymentReference: Schema.optional(Schema.String),
    registeredAt: Schema.Number,
    updatedAt: Schema.Number,
    webhookVersion: Schema.optional(Schema.Number),
    acceptedAt: Schema.optional(Schema.Number),
    withdrawnAt: Schema.optional(Schema.Number),
  }),
)
  .index("by_eventId_and_status", ["eventId", "status"])
  .index("by_eventId_and_participantId", ["eventId", "participantId"])
  .index("by_participantId_and_updatedAt", ["participantId", "updatedAt"])
  .index("by_organizationId_and_updatedAt", ["organizationId", "updatedAt"]);
