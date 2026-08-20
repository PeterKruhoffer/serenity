/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const startsAt = Date.UTC(2026, 10, 4, 8, 0);
const endsAt = Date.UTC(2026, 10, 4, 16, 0);

const publishedEvent = async (autoAccept: boolean) => {
  const t = convexTest(schema, modules);
  const managerToken = "issuer|registration-manager";
  const reviewerToken = "issuer|registration-reviewer";
  const manager = t.withIdentity({ tokenIdentifier: managerToken });
  const reviewer = t.withIdentity({ tokenIdentifier: reviewerToken });
  const workspace = await manager.mutation(api.workspace.createOrganization, {
    organizationName: autoAccept ? "Auto Events" : "Manual Events",
    firstTeamName: "Programs",
    defaultTimezone: "UTC",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("organization_memberships", {
      organizationId: workspace.organizationId,
      identityToken: reviewerToken,
      displayName: "Reviewer",
      role: "super_user",
      status: "active",
      joinedAt: Date.now(),
    });
  });
  const event = await manager.mutation(api.events.create, {
    organizationId: workspace.organizationId,
    teamId: workspace.teamId,
    title: autoAccept ? "Automatic Course" : "Reviewed Course",
    description: "Registration behavior",
    timezone: "UTC",
    dates: [{ startsAt, endsAt, venueName: "Main Hall", sessions: [] }],
  });
  await manager.mutation(api.registrations.configure, {
    eventId: event.eventId,
    capacity: 1,
    autoAccept,
    waitingListEnabled: true,
  });
  const submitted = await manager.mutation(api.publication.submit, { eventId: event.eventId });
  await reviewer.mutation(api.publication.approve, {
    revisionId: submitted.revisionId,
    note: "Approved",
  });
  const detail = await manager.query(api.events.get, { eventId: event.eventId });
  return { t, manager, event, firstDateId: detail.dates[0]!.id };
};

const register = (
  manager: Awaited<ReturnType<typeof publishedEvent>>["manager"],
  eventId: Awaited<ReturnType<typeof publishedEvent>>["event"]["eventId"],
  id: string,
  name: string,
) =>
  manager.mutation(api.registrations.register, {
    eventId,
    externalParticipantId: id,
    displayName: name,
    email: `${id}@example.com`,
    locale: "en",
    ticketName: "Standard",
    priceMinor: 0,
    paymentStatus: "not_required",
  });

describe("registration capacity", () => {
  it("waitlists at capacity and automatically promotes after withdrawal", async () => {
    const { t, manager, event, firstDateId } = await publishedEvent(true);
    const alice = await register(manager, event.eventId, "alice", "Alice North");
    const bob = await register(manager, event.eventId, "bob", "Bob South");
    expect(alice.status).toBe("accepted");
    expect(bob.status).toBe("waitlisted");

    await manager.mutation(api.registrations.declineDate, {
      registrationId: alice.registrationId,
      eventDateId: firstDateId,
    });
    const beforeWithdrawal = await t.run((ctx) => ctx.db.get(event.eventId));
    expect(beforeWithdrawal?.acceptedCount).toBe(1);

    await manager.mutation(api.registrations.withdraw, {
      registrationId: alice.registrationId,
    });
    const listed = await manager.query(api.registrations.list, { eventId: event.eventId });
    expect(listed.find((row) => row.externalParticipantId === "alice")?.status).toBe("withdrawn");
    expect(listed.find((row) => row.externalParticipantId === "bob")?.status).toBe("accepted");
    const afterPromotion = await t.run((ctx) => ctx.db.get(event.eventId));
    expect(afterPromotion?.acceptedCount).toBe(1);
  });

  it("keeps manual registrations pending until a manager accepts them", async () => {
    const { manager, event } = await publishedEvent(false);
    const registration = await register(manager, event.eventId, "casey", "Casey West");
    expect(registration.status).toBe("pending");

    await manager.mutation(api.registrations.accept, {
      registrationId: registration.registrationId,
    });
    const listed = await manager.query(api.registrations.list, { eventId: event.eventId });
    expect(listed[0]?.status).toBe("accepted");
  });
});
