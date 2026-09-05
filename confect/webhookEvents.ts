import type { GenericMutationCtx } from "convex/server";
import { makeFunctionReference } from "convex/server";
import type { DataModel, Id } from "../convex/_generated/dataModel";
import type { WebhookEventType } from "./webhookTypes";

export const WEBHOOK_API_VERSION = "2026-09-01";

const deliverWebhook = makeFunctionReference<
  "action",
  { deliveryId: Id<"webhook_deliveries"> },
  null
>("webhookDelivery:deliver");

type EmitInput = {
  organizationId: Id<"organizations">;
  type: WebhookEventType;
  subjectType: "event" | "registration" | "date_decline" | "test";
  subjectId: string;
  data: unknown;
  occurredAt: number;
  endpointIds?: ReadonlyArray<Id<"webhook_endpoints">>;
  allowDisabledEndpoint?: boolean;
};

export const emitWebhookEvent = async (ctx: GenericMutationCtx<DataModel>, input: EmitInput) => {
  const endpoints = input.endpointIds
    ? await Promise.all(input.endpointIds.map((endpointId) => ctx.db.get(endpointId)))
    : await ctx.db
        .query("webhook_endpoints")
        .withIndex("by_organizationId_and_status", (q) =>
          q.eq("organizationId", input.organizationId).eq("status", "active"),
        )
        .take(10);
  const subscribedEndpoints = endpoints.filter(
    (endpoint): endpoint is NonNullable<typeof endpoint> =>
      Boolean(
        endpoint &&
        endpoint.organizationId === input.organizationId &&
        endpoint.status !== "deleted" &&
        (input.endpointIds || endpoint.subscribedEventTypes.includes(input.type)),
      ),
  );
  if (subscribedEndpoints.length === 0) return null;

  const webhookEventId = await ctx.db.insert("webhook_events", {
    organizationId: input.organizationId,
    type: input.type,
    apiVersion: WEBHOOK_API_VERSION,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    data: JSON.stringify(input.data),
    occurredAt: input.occurredAt,
  });
  const deliveryIds: Array<Id<"webhook_deliveries">> = [];
  for (const endpoint of subscribedEndpoints) {
    const deliveryId = await ctx.db.insert("webhook_deliveries", {
      organizationId: input.organizationId,
      webhookEventId,
      webhookEndpointId: endpoint._id,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: input.occurredAt,
      allowDisabledEndpoint: input.allowDisabledEndpoint ?? false,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
    });
    await ctx.scheduler.runAfter(0, deliverWebhook, { deliveryId });
    deliveryIds.push(deliveryId);
  }
  return { webhookEventId, deliveryIds };
};

export const emitRegistrationWebhook = async (
  ctx: GenericMutationCtx<DataModel>,
  type:
    | "registration.created"
    | "registration.accepted"
    | "registration.withdrawn"
    | "registration.date_declined"
    | "registration.date_decline_reversed",
  registrationId: Id<"registrations">,
  occurredAt: number,
  dateDecline?: { id: Id<"date_declines">; eventDateId: Id<"event_dates">; status: string },
) => {
  const registration = await ctx.db.get(registrationId);
  if (!registration) throw new Error("Registration not found while creating a webhook event.");
  const participant = await ctx.db.get(registration.participantId);
  if (!participant) throw new Error("Participant not found while creating a webhook event.");
  return await emitWebhookEvent(ctx, {
    organizationId: registration.organizationId,
    type,
    subjectType: dateDecline ? "date_decline" : "registration",
    subjectId: dateDecline?.id ?? registration._id,
    occurredAt,
    data: {
      registration: {
        id: registration._id,
        object_version: registration.webhookVersion ?? 1,
        event_id: registration.eventId,
        participant_id: participant._id,
        external_participant_id: participant.externalId,
        status: registration.status,
        payment_status: registration.paymentStatus,
        registered_at: new Date(registration.registeredAt).toISOString(),
        updated_at: new Date(registration.updatedAt).toISOString(),
      },
      ...(dateDecline
        ? {
            date_decline: {
              id: dateDecline.id,
              event_date_id: dateDecline.eventDateId,
              status: dateDecline.status,
            },
          }
        : {}),
    },
  });
};

export const emitPublishedEventWebhook = async (
  ctx: GenericMutationCtx<DataModel>,
  eventId: Id<"events">,
  occurredAt: number,
) => {
  const event = await ctx.db.get(eventId);
  if (!event?.publishedRevisionId || !event.publishedVersion) {
    throw new Error("Published event not found while creating a webhook event.");
  }
  const revision = await ctx.db.get(event.publishedRevisionId);
  if (!revision) throw new Error("Published revision not found while creating a webhook event.");
  return await emitWebhookEvent(ctx, {
    organizationId: event.organizationId,
    type: "event.published",
    subjectType: "event",
    subjectId: event._id,
    occurredAt,
    data: {
      event: {
        id: event._id,
        object_version: event.publishedVersion,
        team_id: event.teamId,
        title: revision.title,
        description: revision.description,
        timezone: revision.timezone,
        status: "published",
        published_at: new Date(occurredAt).toISOString(),
      },
    },
  });
};
