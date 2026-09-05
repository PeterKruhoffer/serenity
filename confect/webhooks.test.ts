/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

const setupEndpoint = async () => {
  const t = convexTest(schema, modules);
  const tokenIdentifier = "issuer|webhook-administrator";
  const administrator = t.withIdentity({ tokenIdentifier });
  const workspace = await administrator.mutation(api.workspace.createOrganization, {
    organizationName: "Webhook Test",
    firstTeamName: "Events",
    defaultTimezone: "UTC",
  });
  const topic = await administrator.mutation(api.events.createTopic, {
    organizationId: workspace.organizationId,
    name: "Webhook events",
  });
  const now = Date.now();
  const endpointId = await t.run((ctx) =>
    ctx.db.insert("webhook_endpoints", {
      organizationId: workspace.organizationId,
      // Insert directly so scheduled delivery exercises the runtime SSRF block without network I/O.
      url: "https://127.0.0.1/serenity",
      description: "Test receiver",
      status: "active",
      subscribedEventTypes: ["registration.created"],
      secretCiphertext: "ciphertext",
      secretIv: "iv",
      secretKeyVersion: 1,
      createdByIdentity: tokenIdentifier,
      createdAt: now,
      updatedAt: now,
      consecutiveFailedEvents: 2,
    }),
  );
  return { t, administrator, workspace, endpointId, topicId: topic.topicId, now };
};

describe("webhook administration", () => {
  it("restricts endpoint management to organization administrators", async () => {
    const { t, administrator, endpointId } = await setupEndpoint();
    const outsider = t.withIdentity({ tokenIdentifier: "issuer|outsider" });
    const input = {
      endpointId,
      url: "https://new.example.com/events",
      description: "Updated receiver",
      subscribedEventTypes: ["registration.accepted" as const],
      status: "active" as const,
    };

    await expect(outsider.mutation(api.webhooks.updateEndpoint, input)).rejects.toMatchObject({
      data: { _tag: "Forbidden" },
    });
    await expect(administrator.mutation(api.webhooks.updateEndpoint, input)).resolves.toBeNull();
    await expect(
      administrator.query(api.webhooks.listEndpoints, {
        organizationId: (await t.run((ctx) => ctx.db.get(endpointId)))!.organizationId,
      }),
    ).resolves.toMatchObject([
      {
        id: endpointId,
        url: "https://new.example.com/events",
        subscribedEventTypes: ["registration.accepted"],
      },
    ]);
  });
});

describe("webhook delivery state", () => {
  it("leases one attempt, records retries, and ignores stale completions", async () => {
    const { t, administrator, endpointId, workspace, now } = await setupEndpoint();
    const eventId = await t.run((ctx) =>
      ctx.db.insert("webhook_events", {
        organizationId: workspace.organizationId,
        type: "registration.created",
        apiVersion: "2026-09-01",
        subjectType: "registration",
        subjectId: "registration-id",
        data: '{"registration":{"id":"registration-id","object_version":1}}',
        occurredAt: now,
      }),
    );
    const deliveryId = await t.run((ctx) =>
      ctx.db.insert("webhook_deliveries", {
        organizationId: workspace.organizationId,
        webhookEventId: eventId,
        webhookEndpointId: endpointId,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: now,
        allowDisabledEndpoint: false,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const prepared = await t.mutation(internal.webhooks.prepareDelivery, {
      deliveryId,
      leaseToken: "lease-one",
      now,
      leaseExpiresAt: now + 30_000,
    });
    expect(prepared).toMatchObject({
      ready: true,
      eventId,
      eventType: "registration.created",
      attemptNumber: 1,
    });
    await expect(
      t.mutation(internal.webhooks.prepareDelivery, {
        deliveryId,
        leaseToken: "lease-two",
        now: now + 1,
        leaseExpiresAt: now + 30_001,
      }),
    ).resolves.toEqual({ ready: false });

    await t.mutation(internal.webhooks.completeDelivery, {
      deliveryId,
      leaseToken: "wrong-lease",
      finishedAt: now + 100,
      durationMs: 100,
      result: "delivered",
      responseStatus: 200,
    });
    expect((await t.run((ctx) => ctx.db.get(deliveryId)))?.status).toBe("attempting");

    await t.mutation(internal.webhooks.completeDelivery, {
      deliveryId,
      leaseToken: "lease-one",
      finishedAt: now + 200,
      durationMs: 200,
      result: "retry",
      responseStatus: 503,
      excerpt: "temporarily unavailable",
      retryDelayMs: 60_000,
    });
    const state = await t.run(async (ctx) => ({
      delivery: await ctx.db.get(deliveryId),
      attempts: await ctx.db.query("webhook_delivery_attempts").collect(),
    }));
    expect(state.delivery).toMatchObject({
      status: "pending",
      attemptCount: 1,
      nextAttemptAt: now + 60_200,
      latestResponseStatus: 503,
    });
    expect(state.attempts).toMatchObject([
      { attemptNumber: 1, outcome: "retrying", responseStatus: 503 },
    ]);

    await t.run((ctx) => ctx.db.patch(deliveryId, { status: "failed", attemptCount: 8 }));
    await expect(
      administrator.mutation(api.webhooks.retryDelivery, { deliveryId }),
    ).resolves.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(deliveryId))).toMatchObject({
      status: "pending",
      attemptCount: 0,
    });
  });
});

describe("webhook event emission", () => {
  it("records immutable snapshots for publication and every registration transition", async () => {
    const { t, administrator, endpointId, topicId, workspace } = await setupEndpoint();
    const reviewerToken = "issuer|webhook-reviewer";
    const reviewer = t.withIdentity({ tokenIdentifier: reviewerToken });
    await t.run(async (ctx) => {
      await ctx.db.insert("organization_memberships", {
        organizationId: workspace.organizationId,
        identityToken: reviewerToken,
        displayName: "Reviewer",
        role: "super_user",
        status: "active",
        joinedAt: Date.now(),
      });
      await ctx.db.patch(endpointId, {
        subscribedEventTypes: [
          "event.published",
          "registration.created",
          "registration.accepted",
          "registration.withdrawn",
          "registration.date_declined",
          "registration.date_decline_reversed",
        ],
      });
    });
    const startsAt = Date.UTC(2026, 10, 4, 8);
    const event = await administrator.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Webhook Course",
      description: "Webhook lifecycle coverage",
      topicId,
      timezone: "UTC",
      dates: [
        {
          startsAt,
          endsAt: startsAt + 3_600_000,
          venueName: "Main Hall",
          sessions: [],
        },
      ],
    });
    await administrator.mutation(api.registrations.configure, {
      eventId: event.eventId,
      capacity: 1,
      autoAccept: true,
      waitingListEnabled: true,
    });
    const submitted = await administrator.mutation(api.publication.submit, {
      eventId: event.eventId,
    });
    await reviewer.mutation(api.publication.approve, {
      revisionId: submitted.revisionId,
      note: "Approved",
    });
    const published = await administrator.query(api.events.get, { eventId: event.eventId });
    const register = (externalParticipantId: string, displayName: string) =>
      administrator.mutation(api.registrations.register, {
        eventId: event.eventId,
        externalParticipantId,
        displayName,
        email: `${externalParticipantId}@example.com`,
        locale: "en",
        ticketName: "Standard",
        priceMinor: 0,
        paymentStatus: "not_required",
      });
    const first = await register("first", "First Attendee");
    const second = await register("second", "Second Attendee");
    const declined = await administrator.mutation(api.registrations.declineDate, {
      registrationId: first.registrationId,
      eventDateId: published.dates[0]!.id,
    });
    await administrator.mutation(api.registrations.overrideDateDecline, {
      declineId: declined.declineId,
    });
    await administrator.mutation(api.registrations.withdraw, {
      registrationId: first.registrationId,
    });

    const webhookEvents = await t.run((ctx) =>
      ctx.db
        .query("webhook_events")
        .withIndex("by_organizationId_and_occurredAt", (q) =>
          q.eq("organizationId", workspace.organizationId),
        )
        .collect(),
    );
    expect(webhookEvents.map(({ type }) => type)).toEqual([
      "event.published",
      "registration.created",
      "registration.created",
      "registration.date_declined",
      "registration.date_decline_reversed",
      "registration.withdrawn",
      "registration.accepted",
    ]);
    const payloads = webhookEvents.map(({ data }) => JSON.parse(data) as Record<string, any>);
    expect(payloads[0]?.event).toMatchObject({
      id: event.eventId,
      object_version: 1,
      status: "published",
    });
    expect(payloads.slice(1).map(({ registration }) => registration.object_version)).toEqual([
      1, 1, 2, 3, 4, 2,
    ]);
    expect(payloads.at(-1)?.registration).toMatchObject({
      id: second.registrationId,
      status: "accepted",
      external_participant_id: "second",
    });
  });
});
