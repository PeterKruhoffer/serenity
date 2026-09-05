import { Table } from "@confect/server";
import * as Schema from "effect/Schema";
import { Id } from "../_generated/id";
import { WebhookEventTypeSchema } from "../webhookTypes";

export default Table.make(() =>
  Schema.Struct({
    organizationId: Id("organizations"),
    url: Schema.String,
    description: Schema.String,
    status: Schema.Literal("active", "disabled", "deleted"),
    subscribedEventTypes: Schema.Array(WebhookEventTypeSchema),
    secretCiphertext: Schema.String,
    secretIv: Schema.String,
    secretKeyVersion: Schema.Number,
    previousSecretCiphertext: Schema.optional(Schema.String),
    previousSecretIv: Schema.optional(Schema.String),
    previousSecretExpiresAt: Schema.optional(Schema.Number),
    createdByIdentity: Schema.String,
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
    consecutiveFailedEvents: Schema.Number,
    disabledReason: Schema.optional(Schema.String),
  }),
)
  .index("by_organizationId_and_status", ["organizationId", "status"])
  .index("by_organizationId_and_createdAt", ["organizationId", "createdAt"]);
