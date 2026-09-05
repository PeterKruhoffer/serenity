import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    webhookEventId: Id("webhook_events"),
    webhookEndpointId: Id("webhook_endpoints"),
    status: Schema.Literal("pending", "attempting", "delivered", "failed"),
    attemptCount: Schema.Number,
    nextAttemptAt: Schema.Number,
    allowDisabledEndpoint: Schema.Boolean,
    leaseToken: Schema.optional(Schema.String),
    leaseExpiresAt: Schema.optional(Schema.Number),
    latestResponseStatus: Schema.optional(Schema.Number),
    latestErrorSummary: Schema.optional(Schema.String),
    deliveredAt: Schema.optional(Schema.Number),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
  }),
)
  .index("by_webhookEventId_and_webhookEndpointId", ["webhookEventId", "webhookEndpointId"])
  .index("by_webhookEndpointId_and_createdAt", ["webhookEndpointId", "createdAt"])
  .index("by_organizationId_and_createdAt", ["organizationId", "createdAt"])
  .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"])
  .index("by_status_and_leaseExpiresAt", ["status", "leaseExpiresAt"]);
