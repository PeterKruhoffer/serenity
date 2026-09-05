import * as Schema from "effect/Schema";

export const WEBHOOK_EVENT_TYPES = [
  "webhook.test",
  "event.published",
  "registration.created",
  "registration.accepted",
  "registration.withdrawn",
  "registration.date_declined",
  "registration.date_decline_reversed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WebhookEventTypeSchema = Schema.Literal(...WEBHOOK_EVENT_TYPES);

export const isWebhookEventType = (value: string): value is WebhookEventType =>
  WEBHOOK_EVENT_TYPES.some((eventType) => eventType === value);
