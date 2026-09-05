import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";
import { WebhookEventTypeSchema } from "./webhookTypes";
import { WorkspaceError } from "./workspace.spec";

const EndpointStatus = Schema.Literal("active", "disabled", "deleted");

const EndpointSummary = Schema.Struct({
  id: Id("webhook_endpoints"),
  url: Schema.String,
  description: Schema.String,
  status: EndpointStatus,
  subscribedEventTypes: Schema.Array(WebhookEventTypeSchema),
  consecutiveFailedEvents: Schema.Number,
  disabledReason: Schema.optional(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});

const DeliverySummary = Schema.Struct({
  id: Id("webhook_deliveries"),
  webhookEndpointId: Id("webhook_endpoints"),
  eventId: Id("webhook_events"),
  eventType: WebhookEventTypeSchema,
  status: Schema.Literal("pending", "attempting", "delivered", "failed"),
  attemptCount: Schema.Number,
  latestResponseStatus: Schema.optional(Schema.Number),
  latestErrorSummary: Schema.optional(Schema.String),
  deliveredAt: Schema.optional(Schema.Number),
  createdAt: Schema.Number,
});

const EndpointInput = {
  organizationId: Id("organizations"),
  url: Schema.String,
  description: Schema.String,
  subscribedEventTypes: Schema.Array(WebhookEventTypeSchema),
};

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listEndpoints",
      args: () => Schema.Struct({ organizationId: Id("organizations") }),
      returns: () => Schema.Array(EndpointSummary),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listDeliveries",
      args: () => Schema.Struct({ organizationId: Id("organizations") }),
      returns: () => Schema.Array(DeliverySummary),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "createEndpoint",
      args: () => Schema.Struct(EndpointInput),
      returns: () =>
        Schema.Struct({ endpointId: Id("webhook_endpoints"), signingSecret: Schema.String }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createEndpointRecord",
      args: () =>
        Schema.Struct({
          ...EndpointInput,
          identityToken: Schema.String,
          secretCiphertext: Schema.String,
          secretIv: Schema.String,
        }),
      returns: () => Schema.Struct({ endpointId: Id("webhook_endpoints") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateEndpoint",
      args: () =>
        Schema.Struct({
          endpointId: Id("webhook_endpoints"),
          url: Schema.String,
          description: Schema.String,
          subscribedEventTypes: Schema.Array(WebhookEventTypeSchema),
          status: Schema.Literal("active", "disabled"),
        }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteEndpoint",
      args: () => Schema.Struct({ endpointId: Id("webhook_endpoints") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "rotateSecret",
      args: () => Schema.Struct({ endpointId: Id("webhook_endpoints") }),
      returns: () => Schema.Struct({ signingSecret: Schema.String }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "rotateSecretRecord",
      args: () =>
        Schema.Struct({
          endpointId: Id("webhook_endpoints"),
          identityToken: Schema.String,
          secretCiphertext: Schema.String,
          secretIv: Schema.String,
          now: Schema.Number,
        }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "sendTest",
      args: () => Schema.Struct({ endpointId: Id("webhook_endpoints") }),
      returns: () => Schema.Struct({ deliveryId: Id("webhook_deliveries") }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "retryDelivery",
      args: () => Schema.Struct({ deliveryId: Id("webhook_deliveries") }),
      returns: () => Schema.Null,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "prepareDelivery",
      args: () =>
        Schema.Struct({
          deliveryId: Id("webhook_deliveries"),
          leaseToken: Schema.String,
          now: Schema.Number,
          leaseExpiresAt: Schema.Number,
        }),
      returns: () =>
        Schema.Union(
          Schema.Struct({ ready: Schema.Literal(false) }),
          Schema.Struct({
            ready: Schema.Literal(true),
            endpointUrl: Schema.String,
            secretCiphertext: Schema.String,
            secretIv: Schema.String,
            previousSecretCiphertext: Schema.optional(Schema.String),
            previousSecretIv: Schema.optional(Schema.String),
            eventId: Id("webhook_events"),
            eventType: WebhookEventTypeSchema,
            apiVersion: Schema.String,
            organizationId: Id("organizations"),
            occurredAt: Schema.Number,
            data: Schema.String,
            attemptNumber: Schema.Number,
          }),
        ),
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "completeDelivery",
      args: () =>
        Schema.Struct({
          deliveryId: Id("webhook_deliveries"),
          leaseToken: Schema.String,
          finishedAt: Schema.Number,
          durationMs: Schema.Number,
          result: Schema.Literal("delivered", "retry", "failed"),
          responseStatus: Schema.optional(Schema.Number),
          excerpt: Schema.optional(Schema.String),
          retryDelayMs: Schema.optional(Schema.Number),
        }),
      returns: () => Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recoverDeliveries",
      args: () => Schema.Struct({}),
      returns: () => Schema.Null,
    }),
  );
