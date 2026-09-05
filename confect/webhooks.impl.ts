import { FunctionImpl, GroupImpl } from "@confect/server";
import { makeFunctionReference } from "convex/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { Id } from "../convex/_generated/dataModel";
import databaseSchema from "./_generated/schema";
import refs from "./_generated/refs";
import { DatabaseReader, DatabaseWriter, MutationCtx, MutationRunner } from "./_generated/services";
import { membershipFor, requireIdentity } from "./access";
import { createSigningSecret, encryptSigningSecret } from "./webhookCrypto";
import { emitWebhookEvent } from "./webhookEvents";
import { isWebhookEventType } from "./webhookTypes";
import { normalizeWebhookUrl } from "./webhookUrl";
import webhooks from "./webhooks.spec";
import { Conflict, Forbidden, InvalidInput, type Unauthenticated } from "./workspace.spec";

const getIdentity = requireIdentity("Sign in to manage webhooks.");
const MAX_ENDPOINTS = 10;
const MAX_ATTEMPTS = 8;
const DISABLE_AFTER_FAILED_EVENTS = 5;
const SECRET_ROTATION_WINDOW_MS = 24 * 60 * 60 * 1_000;
const deliverWebhook = makeFunctionReference<
  "action",
  { deliveryId: Id<"webhook_deliveries"> },
  null
>("webhookDelivery:deliver");

type WorkspaceFailure = Unauthenticated | Forbidden | Conflict | InvalidInput;

const isWorkspaceFailure = (error: unknown): error is WorkspaceFailure =>
  Boolean(
    error &&
    typeof error === "object" &&
    "_tag" in error &&
    ["Unauthenticated", "Forbidden", "Conflict", "InvalidInput"].includes(String(error._tag)),
  );

const preserveWorkspaceFailure = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(
    Effect.catchAll((error) =>
      isWorkspaceFailure(error) ? Effect.fail(error) : Effect.die(error),
    ),
  );

const requireAdministrator = (organizationId: Parameters<typeof membershipFor>[0], token: string) =>
  membershipFor(organizationId, token).pipe(
    Effect.flatMap((membership) =>
      membership.role === "administrator"
        ? Effect.succeed(membership)
        : Effect.fail(
            new Forbidden({ message: "Only organization administrators can manage webhooks." }),
          ),
    ),
  );

const endpointInput = (
  rawUrl: string,
  rawDescription: string,
  subscribedEventTypes: ReadonlyArray<string>,
) =>
  Effect.try({
    try: () => {
      const description = rawDescription.trim().replace(/\s+/g, " ");
      if (description.length > 160) {
        throw new Error("Webhook descriptions cannot exceed 160 characters.");
      }
      if (subscribedEventTypes.length === 0) {
        throw new Error("Select at least one webhook event.");
      }
      if (
        subscribedEventTypes.length > 7 ||
        new Set(subscribedEventTypes).size !== subscribedEventTypes.length ||
        subscribedEventTypes.some((eventType) => !isWebhookEventType(eventType))
      ) {
        throw new Error("The webhook event selection is invalid.");
      }
      return {
        url: normalizeWebhookUrl(rawUrl),
        description,
        subscribedEventTypes: subscribedEventTypes.filter(isWebhookEventType),
      };
    },
    catch: (error) =>
      new InvalidInput({
        message: error instanceof Error ? error.message : "The webhook settings are invalid.",
      }),
  });

const secretMaterial = () =>
  Effect.tryPromise({
    try: async () => {
      const signingSecret = createSigningSecret();
      const encrypted = await encryptSigningSecret(signingSecret);
      return { signingSecret, ...encrypted };
    },
    catch: () =>
      new InvalidInput({
        message: "Webhook secrets are not configured for this Serenity deployment.",
      }),
  });

const listEndpoints = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "listEndpoints",
  ({ organizationId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      yield* requireAdministrator(organizationId, identity.tokenIdentifier);
      const endpoints = yield* reader
        .table("webhook_endpoints")
        .index(
          "by_organizationId_and_createdAt",
          (q) => q.eq("organizationId", organizationId),
          "desc",
        )
        .take(50);
      return endpoints
        .filter((endpoint) => endpoint.status !== "deleted")
        .map((endpoint) => ({
          id: endpoint._id,
          url: endpoint.url,
          description: endpoint.description,
          status: endpoint.status,
          subscribedEventTypes: endpoint.subscribedEventTypes,
          consecutiveFailedEvents: endpoint.consecutiveFailedEvents,
          ...(endpoint.disabledReason ? { disabledReason: endpoint.disabledReason } : {}),
          createdAt: endpoint.createdAt,
          updatedAt: endpoint.updatedAt,
        }));
    }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const listDeliveries = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "listDeliveries",
  ({ organizationId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      yield* requireAdministrator(organizationId, identity.tokenIdentifier);
      const deliveries = yield* reader
        .table("webhook_deliveries")
        .index(
          "by_organizationId_and_createdAt",
          (q) => q.eq("organizationId", organizationId),
          "desc",
        )
        .take(100);
      return yield* Effect.forEach(deliveries, (delivery) =>
        Effect.gen(function* () {
          const event = yield* reader.table("webhook_events").get(delivery.webhookEventId);
          if (!isWebhookEventType(event.type)) {
            return yield* Effect.die(new Error(`Unknown webhook event type: ${event.type}`));
          }
          return {
            id: delivery._id,
            webhookEndpointId: delivery.webhookEndpointId,
            eventId: event._id,
            eventType: event.type,
            status: delivery.status,
            attemptCount: delivery.attemptCount,
            ...(delivery.latestResponseStatus === undefined
              ? {}
              : { latestResponseStatus: delivery.latestResponseStatus }),
            ...(delivery.latestErrorSummary
              ? { latestErrorSummary: delivery.latestErrorSummary }
              : {}),
            ...(delivery.deliveredAt ? { deliveredAt: delivery.deliveredAt } : {}),
            createdAt: delivery.createdAt,
          };
        }),
      );
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        GetByIdFailure: (error) => Effect.die(error),
      }),
    ),
);

const createEndpoint = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "createEndpoint",
  ({ organizationId, url, description, subscribedEventTypes }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const runner = yield* MutationRunner;
      const material = yield* secretMaterial();
      const created = yield* preserveWorkspaceFailure(
        runner(refs.internal.webhooks.createEndpointRecord, {
          organizationId,
          url,
          description,
          subscribedEventTypes,
          identityToken: identity.tokenIdentifier,
          secretCiphertext: material.ciphertext,
          secretIv: material.iv,
        }),
      );
      return { endpointId: created.endpointId, signingSecret: material.signingSecret };
    }),
);

const createEndpointRecord = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "createEndpointRecord",
  ({
    organizationId,
    url,
    description,
    subscribedEventTypes,
    identityToken,
    secretCiphertext,
    secretIv,
  }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      yield* requireAdministrator(organizationId, identityToken);
      const normalized = yield* endpointInput(url, description, subscribedEventTypes);
      const existing = yield* reader
        .table("webhook_endpoints")
        .index("by_organizationId_and_createdAt", (q) => q.eq("organizationId", organizationId))
        .take(MAX_ENDPOINTS + 1);
      if (existing.filter((endpoint) => endpoint.status !== "deleted").length >= MAX_ENDPOINTS) {
        return yield* Effect.fail(
          new Conflict({ message: `An organization can have up to ${MAX_ENDPOINTS} webhooks.` }),
        );
      }
      const now = Date.now();
      const endpointId = yield* writer.table("webhook_endpoints").insert({
        organizationId,
        ...normalized,
        status: "disabled",
        secretCiphertext,
        secretIv,
        secretKeyVersion: 1,
        createdByIdentity: identityToken,
        createdAt: now,
        updatedAt: now,
        consecutiveFailedEvents: 0,
      });
      yield* writer.table("audit_entries").insert({
        organizationId,
        actorIdentity: identityToken,
        action: "webhook.endpoint_created",
        entityType: "webhook_endpoint",
        entityId: endpointId,
        summary: `Created webhook endpoint ${normalized.url}`,
        occurredAt: now,
      });
      return { endpointId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const updateEndpoint = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "updateEndpoint",
  ({ endpointId, url, description, subscribedEventTypes, status }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const endpoint = yield* reader
        .table("webhook_endpoints")
        .get(endpointId)
        .pipe(Effect.mapError(() => new Forbidden({ message: "Webhook endpoint not found." })));
      yield* requireAdministrator(endpoint.organizationId, identity.tokenIdentifier);
      if (endpoint.status === "deleted") {
        return yield* Effect.fail(new Conflict({ message: "This webhook endpoint was deleted." }));
      }
      const normalized = yield* endpointInput(url, description, subscribedEventTypes);
      const now = Date.now();
      yield* writer.table("webhook_endpoints").patch(endpointId, {
        ...normalized,
        status,
        updatedAt: now,
        ...(status === "active" ? { consecutiveFailedEvents: 0, disabledReason: undefined } : {}),
      });
      yield* writer.table("audit_entries").insert({
        organizationId: endpoint.organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "webhook.endpoint_updated",
        entityType: "webhook_endpoint",
        entityId: endpointId,
        summary: `Updated webhook endpoint ${normalized.url}`,
        occurredAt: now,
      });
      return null;
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
        GetByIdFailure: (error) => Effect.die(error),
      }),
    ),
);

const deleteEndpoint = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "deleteEndpoint",
  ({ endpointId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const endpoint = yield* reader
        .table("webhook_endpoints")
        .get(endpointId)
        .pipe(Effect.mapError(() => new Forbidden({ message: "Webhook endpoint not found." })));
      yield* requireAdministrator(endpoint.organizationId, identity.tokenIdentifier);
      if (endpoint.status === "deleted") return null;
      const now = Date.now();
      yield* writer.table("webhook_endpoints").patch(endpointId, {
        status: "deleted",
        updatedAt: now,
        disabledReason: "Deleted by an administrator",
      });
      yield* writer.table("audit_entries").insert({
        organizationId: endpoint.organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "webhook.endpoint_deleted",
        entityType: "webhook_endpoint",
        entityId: endpointId,
        summary: `Deleted webhook endpoint ${endpoint.url}`,
        occurredAt: now,
      });
      return null;
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
        GetByIdFailure: (error) => Effect.die(error),
      }),
    ),
);

const rotateSecret = FunctionImpl.make(databaseSchema, webhooks, "rotateSecret", ({ endpointId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const runner = yield* MutationRunner;
    const material = yield* secretMaterial();
    yield* preserveWorkspaceFailure(
      runner(refs.internal.webhooks.rotateSecretRecord, {
        endpointId,
        identityToken: identity.tokenIdentifier,
        secretCiphertext: material.ciphertext,
        secretIv: material.iv,
        now: Date.now(),
      }),
    );
    return { signingSecret: material.signingSecret };
  }),
);

const rotateSecretRecord = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "rotateSecretRecord",
  ({ endpointId, identityToken, secretCiphertext, secretIv, now }) =>
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const endpoint = yield* reader
        .table("webhook_endpoints")
        .get(endpointId)
        .pipe(Effect.mapError(() => new Forbidden({ message: "Webhook endpoint not found." })));
      yield* requireAdministrator(endpoint.organizationId, identityToken);
      if (endpoint.status === "deleted") {
        return yield* Effect.fail(new Conflict({ message: "This webhook endpoint was deleted." }));
      }
      yield* writer.table("webhook_endpoints").patch(endpointId, {
        previousSecretCiphertext: endpoint.secretCiphertext,
        previousSecretIv: endpoint.secretIv,
        previousSecretExpiresAt: now + SECRET_ROTATION_WINDOW_MS,
        secretCiphertext,
        secretIv,
        secretKeyVersion: endpoint.secretKeyVersion + 1,
        updatedAt: now,
      });
      yield* writer.table("audit_entries").insert({
        organizationId: endpoint.organizationId,
        actorIdentity: identityToken,
        action: "webhook.secret_rotated",
        entityType: "webhook_endpoint",
        entityId: endpointId,
        summary: `Rotated the signing secret for ${endpoint.url}`,
        occurredAt: now,
      });
      return null;
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
        GetByIdFailure: (error) => Effect.die(error),
      }),
    ),
);

const sendTest = FunctionImpl.make(databaseSchema, webhooks, "sendTest", ({ endpointId }) =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const ctx = yield* MutationCtx;
    const endpoint = yield* Effect.promise(() => ctx.db.get(endpointId));
    if (!endpoint || endpoint.status === "deleted") {
      return yield* Effect.fail(new Forbidden({ message: "Webhook endpoint not found." }));
    }
    yield* requireAdministrator(endpoint.organizationId, identity.tokenIdentifier);
    const now = Date.now();
    const emitted = yield* Effect.promise(() =>
      emitWebhookEvent(ctx, {
        organizationId: endpoint.organizationId,
        type: "webhook.test",
        subjectType: "test",
        subjectId: endpointId,
        data: { test: { message: "Serenity webhook endpoint test" } },
        occurredAt: now,
        endpointIds: [endpointId],
        allowDisabledEndpoint: true,
      }),
    );
    if (!emitted?.deliveryIds[0]) return yield* Effect.die(new Error("Test delivery not created."));
    return { deliveryId: emitted.deliveryIds[0] };
  }),
);

const retryDelivery = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "retryDelivery",
  ({ deliveryId }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const ctx = yield* MutationCtx;
      const delivery = yield* Effect.promise(() => ctx.db.get(deliveryId));
      if (!delivery) {
        return yield* Effect.fail(new Forbidden({ message: "Webhook delivery not found." }));
      }
      yield* requireAdministrator(delivery.organizationId, identity.tokenIdentifier);
      if (delivery.status !== "failed") {
        return yield* Effect.fail(
          new Conflict({ message: "Only failed webhook deliveries can be retried." }),
        );
      }
      const endpoint = yield* Effect.promise(() => ctx.db.get(delivery.webhookEndpointId));
      if (!endpoint || endpoint.status !== "active") {
        return yield* Effect.fail(
          new Conflict({ message: "Enable the webhook endpoint before retrying this delivery." }),
        );
      }
      const now = Date.now();
      yield* Effect.promise(async () => {
        await ctx.db.patch(deliveryId, {
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: now,
          latestErrorSummary: undefined,
          leaseToken: undefined,
          leaseExpiresAt: undefined,
          updatedAt: now,
        });
        await ctx.scheduler.runAfter(0, deliverWebhook, { deliveryId });
      });
      return null;
    }),
);

const prepareDelivery = FunctionImpl.make(
  databaseSchema,
  webhooks,
  "prepareDelivery",
  ({ deliveryId, leaseToken, now, leaseExpiresAt }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      const delivery = yield* Effect.promise(() => ctx.db.get(deliveryId));
      if (!delivery || delivery.status === "delivered" || delivery.status === "failed") {
        return { ready: false } as const;
      }
      const canAcquire =
        (delivery.status === "pending" && delivery.nextAttemptAt <= now) ||
        (delivery.status === "attempting" && (delivery.leaseExpiresAt ?? 0) <= now);
      if (!canAcquire) return { ready: false } as const;
      const endpoint = yield* Effect.promise(() => ctx.db.get(delivery.webhookEndpointId));
      const event = yield* Effect.promise(() => ctx.db.get(delivery.webhookEventId));
      if (
        !endpoint ||
        !event ||
        endpoint.status === "deleted" ||
        (endpoint.status === "disabled" && !delivery.allowDisabledEndpoint)
      ) {
        yield* Effect.promise(() =>
          ctx.db.patch(deliveryId, {
            status: "failed",
            latestErrorSummary: "Webhook endpoint is not active.",
            updatedAt: now,
          }),
        );
        return { ready: false } as const;
      }
      if (!isWebhookEventType(event.type)) {
        yield* Effect.promise(() =>
          ctx.db.patch(deliveryId, {
            status: "failed",
            latestErrorSummary: "Webhook event type is not supported.",
            updatedAt: now,
          }),
        );
        return { ready: false } as const;
      }
      const attemptNumber = delivery.attemptCount + 1;
      yield* Effect.promise(() =>
        ctx.db.patch(deliveryId, {
          status: "attempting",
          attemptCount: attemptNumber,
          leaseToken,
          leaseExpiresAt,
          updatedAt: now,
        }),
      );
      const previousSecretActive =
        endpoint.previousSecretCiphertext &&
        endpoint.previousSecretIv &&
        (endpoint.previousSecretExpiresAt ?? 0) > now;
      return {
        ready: true,
        endpointUrl: endpoint.url,
        secretCiphertext: endpoint.secretCiphertext,
        secretIv: endpoint.secretIv,
        ...(previousSecretActive
          ? {
              previousSecretCiphertext: endpoint.previousSecretCiphertext,
              previousSecretIv: endpoint.previousSecretIv,
            }
          : {}),
        eventId: event._id,
        eventType: event.type,
        apiVersion: event.apiVersion,
        organizationId: event.organizationId,
        occurredAt: event.occurredAt,
        data: event.data,
        attemptNumber,
      } as const;
    }),
);

const completeDelivery = FunctionImpl.make(databaseSchema, webhooks, "completeDelivery", (args) =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    const delivery = yield* Effect.promise(() => ctx.db.get(args.deliveryId));
    if (!delivery || delivery.status !== "attempting" || delivery.leaseToken !== args.leaseToken) {
      return null;
    }
    const retry = args.result === "retry" && delivery.attemptCount < MAX_ATTEMPTS;
    const outcome = args.result === "delivered" ? "delivered" : retry ? "retrying" : "failed";
    yield* Effect.promise(() =>
      ctx.db.insert("webhook_delivery_attempts", {
        webhookDeliveryId: delivery._id,
        attemptNumber: delivery.attemptCount,
        startedAt: Math.max(delivery.updatedAt, args.finishedAt - args.durationMs),
        finishedAt: args.finishedAt,
        outcome,
        ...(args.responseStatus === undefined ? {} : { responseStatus: args.responseStatus }),
        durationMs: args.durationMs,
        ...(args.excerpt ? { excerpt: args.excerpt.slice(0, 2_048) } : {}),
      }),
    );
    const endpoint = yield* Effect.promise(() => ctx.db.get(delivery.webhookEndpointId));
    if (args.result === "delivered") {
      yield* Effect.promise(() =>
        ctx.db.patch(delivery._id, {
          status: "delivered",
          deliveredAt: args.finishedAt,
          latestResponseStatus: args.responseStatus,
          latestErrorSummary: undefined,
          leaseToken: undefined,
          leaseExpiresAt: undefined,
          updatedAt: args.finishedAt,
        }),
      );
      if (endpoint && endpoint.status !== "deleted") {
        yield* Effect.promise(() =>
          ctx.db.patch(endpoint._id, {
            consecutiveFailedEvents: 0,
            updatedAt: args.finishedAt,
          }),
        );
      }
      return null;
    }
    if (retry) {
      const delay = Math.max(1_000, args.retryDelayMs ?? 60_000);
      yield* Effect.promise(async () => {
        await ctx.db.patch(delivery._id, {
          status: "pending",
          nextAttemptAt: args.finishedAt + delay,
          latestResponseStatus: args.responseStatus,
          latestErrorSummary: args.excerpt?.slice(0, 500) || "Delivery failed; retry scheduled.",
          leaseToken: undefined,
          leaseExpiresAt: undefined,
          updatedAt: args.finishedAt,
        });
        await ctx.scheduler.runAfter(delay, deliverWebhook, {
          deliveryId: delivery._id,
        });
      });
      return null;
    }
    yield* Effect.promise(() =>
      ctx.db.patch(delivery._id, {
        status: "failed",
        latestResponseStatus: args.responseStatus,
        latestErrorSummary: args.excerpt?.slice(0, 500) || "Webhook delivery failed.",
        leaseToken: undefined,
        leaseExpiresAt: undefined,
        updatedAt: args.finishedAt,
      }),
    );
    if (endpoint && endpoint.status !== "deleted") {
      const failures = endpoint.consecutiveFailedEvents + 1;
      const disable = args.responseStatus === 410 || failures >= DISABLE_AFTER_FAILED_EVENTS;
      yield* Effect.promise(() =>
        ctx.db.patch(endpoint._id, {
          consecutiveFailedEvents: failures,
          ...(disable
            ? {
                status: "disabled" as const,
                disabledReason:
                  args.responseStatus === 410
                    ? "The endpoint returned HTTP 410."
                    : `${failures} consecutive events failed.`,
              }
            : {}),
          updatedAt: args.finishedAt,
        }),
      );
    }
    return null;
  }),
);

const recoverDeliveries = FunctionImpl.make(databaseSchema, webhooks, "recoverDeliveries", () =>
  Effect.gen(function* () {
    const ctx = yield* MutationCtx;
    const now = Date.now();
    const [expired, pending] = yield* Effect.promise(() =>
      Promise.all([
        ctx.db
          .query("webhook_deliveries")
          .withIndex("by_status_and_leaseExpiresAt", (q) =>
            q.eq("status", "attempting").lte("leaseExpiresAt", now),
          )
          .take(100),
        ctx.db
          .query("webhook_deliveries")
          .withIndex("by_status_and_nextAttemptAt", (q) =>
            q.eq("status", "pending").lte("nextAttemptAt", now),
          )
          .take(100),
      ]),
    );
    for (const delivery of expired) {
      yield* Effect.promise(() =>
        ctx.db.patch(delivery._id, {
          status: "pending",
          nextAttemptAt: now,
          leaseToken: undefined,
          leaseExpiresAt: undefined,
          updatedAt: now,
        }),
      );
    }
    for (const delivery of [...expired, ...pending]) {
      yield* Effect.promise(() =>
        ctx.scheduler.runAfter(0, deliverWebhook, {
          deliveryId: delivery._id,
        }),
      );
    }
    return null;
  }),
);

export default GroupImpl.make(databaseSchema, webhooks).pipe(
  Layer.provide(listEndpoints),
  Layer.provide(listDeliveries),
  Layer.provide(createEndpoint),
  Layer.provide(createEndpointRecord),
  Layer.provide(updateEndpoint),
  Layer.provide(deleteEndpoint),
  Layer.provide(rotateSecret),
  Layer.provide(rotateSecretRecord),
  Layer.provide(sendTest),
  Layer.provide(retryDelivery),
  Layer.provide(prepareDelivery),
  Layer.provide(completeDelivery),
  Layer.provide(recoverDeliveries),
  GroupImpl.finalize,
);
