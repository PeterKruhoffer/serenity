/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const attendee = anyApi.attendee;
const startsAt = Date.UTC(2026, 10, 14, 17, 30);
const endsAt = Date.UTC(2026, 10, 14, 20, 0);
const firstAttendee = "a".repeat(64);
const secondAttendee = "b".repeat(64);

type SignupField = {
  type: "text" | "textarea" | "yes_no" | "checkboxes";
  label: string;
  required: boolean;
  options: string[];
  section?: string;
};

const publishedEvent = async (signupFields: SignupField[] = []) => {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const manager = t.withIdentity({ tokenIdentifier: "issuer|manager", name: "Morgan" });
  const reviewer = t.withIdentity({ tokenIdentifier: "issuer|reviewer", name: "Riley" });
  const workspace = await manager.mutation(api.workspace.createOrganization, {
    organizationName: "Open Table",
    firstTeamName: "Community",
    defaultTimezone: "UTC",
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
    signupFields,
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
  return { t, manager, event };
};

describe("attendee API", () => {
  it("exposes approved snapshots without organizer membership", async () => {
    const { t, event } = await publishedEvent();
    await expect(
      t.query(attendee.listEvents, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).resolves.toMatchObject({
      isDone: true,
      page: [
        expect.objectContaining({
          id: event.eventId,
          title: "Autumn Supper",
          organizationName: "Open Table",
          registrationState: "open",
        }),
      ],
    });
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

  it("rate limits repeated public registration attempts", async () => {
    const { t, event } = await publishedEvent();
    const request = () =>
      t.mutation(attendee.register, {
        attendeeKey: firstAttendee,
        eventId: event.eventId,
        displayName: "Alex Guest",
      });

    for (let attempt = 0; attempt < 5; attempt += 1) await request();
    await expect(request()).rejects.toThrow();
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

  it("publishes an immutable form and validates and stores registration answers", async () => {
    const { t, manager, event } = await publishedEvent([
      {
        type: "text",
        label: "Job title",
        required: true,
        options: [],
        section: "About you",
      },
      {
        type: "checkboxes",
        label: "Dietary requirements",
        required: false,
        options: ["Vegetarian", "Vegan"],
      },
      { type: "yes_no", label: "First visit?", required: true, options: [] },
    ]);
    const publicEvent = await t.query(attendee.getEvent, { eventId: event.eventId });
    expect(publicEvent?.signupFields).toMatchObject([
      { label: "Job title", type: "text", required: true, section: "About you" },
      { label: "Dietary requirements", options: ["Vegetarian", "Vegan"] },
      { label: "First visit?", type: "yes_no", required: true },
    ]);
    const [jobTitle, dietary, firstVisit] = publicEvent!.signupFields;

    await expect(
      t.mutation(attendee.register, {
        attendeeKey: firstAttendee,
        eventId: event.eventId,
        displayName: "Alex Guest",
        answers: [],
      }),
    ).rejects.toThrow("Job title is required");
    await expect(
      t.mutation(attendee.register, {
        attendeeKey: firstAttendee,
        eventId: event.eventId,
        displayName: "Alex Guest",
        answers: [
          { fieldId: jobTitle!.id, value: "Designer" },
          { fieldId: dietary!.id, value: ["Not an option"] },
          { fieldId: firstVisit!.id, value: true },
        ],
      }),
    ).rejects.toThrow("contains an invalid choice");

    const registration = await t.mutation(attendee.register, {
      attendeeKey: firstAttendee,
      eventId: event.eventId,
      displayName: "Alex Guest",
      answers: [
        { fieldId: jobTitle!.id, value: "Designer" },
        { fieldId: dietary!.id, value: ["Vegetarian"] },
        { fieldId: firstVisit!.id, value: false },
      ],
    });
    const managed = await manager.query(api.registrations.list, { eventId: event.eventId });
    expect(managed).toContainEqual(
      expect.objectContaining({
        id: registration.registrationId,
        answers: [
          expect.objectContaining({ label: "Job title", value: "Designer" }),
          expect.objectContaining({ label: "Dietary requirements", value: ["Vegetarian"] }),
          expect.objectContaining({ label: "First visit?", value: false }),
        ],
      }),
    );

    await t.run(async (ctx) => {
      const draftField = await ctx.db
        .query("signup_form_fields")
        .withIndex("by_eventId_and_sortOrder", (q) => q.eq("eventId", event.eventId))
        .first();
      if (draftField) await ctx.db.patch(draftField._id, { label: "Draft-only label" });
    });
    const stillPublished = await t.query(attendee.getEvent, { eventId: event.eventId });
    expect(stillPublished?.signupFields[0]?.label).toBe("Job title");
  });
});
