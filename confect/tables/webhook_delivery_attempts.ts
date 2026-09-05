import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    webhookDeliveryId: Id("webhook_deliveries"),
    attemptNumber: Schema.Number,
    startedAt: Schema.Number,
    finishedAt: Schema.Number,
    outcome: Schema.Literal("delivered", "retrying", "failed"),
    responseStatus: Schema.optional(Schema.Number),
    durationMs: Schema.Number,
    excerpt: Schema.optional(Schema.String),
  }),
).index("by_webhookDeliveryId_and_attemptNumber", ["webhookDeliveryId", "attemptNumber"]);
