/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const attendee = anyApi.attendee;
const startsAt = Date.UTC(2026, 10, 14, 17, 30);
const endsAt = Date.UTC(2026, 10, 14, 20, 0);
const firstAttendee = "a".repeat(64);
const secondAttendee = "b".repeat(64);

const publishedEvent = async () => {
  const t = convexTest(schema, modules);
  const manager = t.withIdentity({ tokenIdentifier: "issuer|manager", name: "Morgan" });
  const reviewer = t.withIdentity({ tokenIdentifier: "issuer|reviewer", name: "Riley" });
  const workspace = await manager.mutation(api.workspace.createOrganization, {
    organizationName: "Open Table",
    firstTeamName: "Community",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("organization_memberships", {
      organizationId: workspace.organizationId,
      identityToken: "issuer|reviewer",
      displayName: "Riley",
      role: "super_user",
      status: "active",
      joinedAt: Date.now(),
    });
  });
  const event = await manager.mutation(api.events.create, {
    organizationId: workspace.organizationId,
    teamId: workspace.teamId,
    title: "Autumn Supper",
    description: "A relaxed evening around one shared table.",
    timezone: "Europe/Copenhagen",
    dates: [{ startsAt, endsAt, venueName: "The Glasshouse", sessions: [] }],
  });
  await manager.mutation(api.registrations.configure, {
    eventId: event.eventId,
    capacity: 1,
    autoAccept: true,
    waitingListEnabled: true,
  });
  const submitted = await manager.mutation(api.publication.submit, { eventId: event.eventId });
  await reviewer.mutation(api.publication.approve, {
    revisionId: submitted.revisionId,
    note: "Ready for guests",
  });
  return { t, event };
};

describe("attendee API", () => {
  it("exposes approved snapshots without organizer membership", async () => {
    const { t, event } = await publishedEvent();
    await expect(t.query(attendee.listEvents, {})).resolves.toEqual([
      expect.objectContaining({
        id: event.eventId,
        title: "Autumn Supper",
        organizationName: "Open Table",
        registrationState: "open",
      }),
    ]);
    await expect(t.query(attendee.getEvent, { eventId: event.eventId })).resolves.toMatchObject({
      title: "Autumn Supper",
      dates: [{ venueName: "The Glasshouse" }],
    });
  });

  it("keeps guest registrations private and promotes the waitlist", async () => {
    const { t, event } = await publishedEvent();
    const first = await t.mutation(attendee.register, {
      attendeeKey: firstAttendee,
      eventId: event.eventId,
      displayName: "Alex Guest",
      email: "alex@example.com",
    });
    expect(first.status).toBe("accepted");
    await expect(
      t.mutation(attendee.register, {
        attendeeKey: firstAttendee,
        eventId: event.eventId,
        displayName: "Alex Guest",
      }),
    ).resolves.toEqual(first);

    const second = await t.mutation(attendee.register, {
      attendeeKey: secondAttendee,
      eventId: event.eventId,
      displayName: "Sam Guest",
    });
    expect(second.status).toBe("waitlisted");
    await expect(t.query(attendee.listMine, { attendeeKey: firstAttendee })).resolves.toEqual([
      expect.objectContaining({ id: first.registrationId, status: "accepted" }),
    ]);
    await expect(t.query(attendee.listMine, { attendeeKey: secondAttendee })).resolves.toEqual([
      expect.objectContaining({ id: second.registrationId, status: "waitlisted" }),
    ]);

    await t.mutation(attendee.withdraw, {
      attendeeKey: firstAttendee,
      registrationId: first.registrationId,
    });
    await expect(t.query(attendee.listMine, { attendeeKey: secondAttendee })).resolves.toEqual([
      expect.objectContaining({ id: second.registrationId, status: "accepted" }),
    ]);
  });

  it("rejects invalid attendee session identifiers", async () => {
    const { t } = await publishedEvent();
    await expect(t.query(attendee.listMine, { attendeeKey: "guessable" })).rejects.toThrow(
      "The attendee session is invalid",
    );
  });

  it("uses a verified identity instead of the guest key for signed-in attendees", async () => {
    const { t, event } = await publishedEvent();
    const signedIn = t.withIdentity({
      tokenIdentifier: "https://api.workos.com/|user_attendee",
      name: "Taylor",
    });
    const registration = await signedIn.mutation(attendee.register, {
      attendeeKey: "not-used-for-signed-in-users",
      eventId: event.eventId,
      displayName: "Taylor Member",
    });

    await expect(
      signedIn.query(attendee.listMine, { attendeeKey: "a-different-browser-key" }),
    ).resolves.toEqual([
      expect.objectContaining({ id: registration.registrationId, status: "accepted" }),
    ]);
  });
});
