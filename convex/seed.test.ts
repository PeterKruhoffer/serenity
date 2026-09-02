/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("demo seed", () => {
  it("creates a broad, internally consistent data set and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const actorIdentity = "issuer|seed-admin";
    const admin = t.withIdentity({ tokenIdentifier: actorIdentity, name: "Seed Admin" });
    const workspace = await admin.mutation(api.workspace.createOrganization, {
      organizationName: "Seed Test",
      firstTeamName: "Network",
      defaultTimezone: "Europe/Copenhagen",
    });
    const topic = await admin.mutation(api.events.createTopic, {
      organizationId: workspace.organizationId,
      name: "Seed topic",
    });
    const existing = await admin.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Existing Event",
      description: "This event must survive a demo reset.",
      topicId: topic.topicId,
      timezone: "Europe/Copenhagen",
      dates: [
        {
          startsAt: Date.UTC(2026, 9, 1, 8),
          endsAt: Date.UTC(2026, 9, 1, 16),
          venueName: "Existing venue",
          sessions: [],
        },
      ],
    });

    await expect(
      t.mutation(internal.seed.demo, {
        organizationId: workspace.organizationId,
        actorIdentity,
      }),
    ).resolves.toEqual({ created: true, eventCount: 9, teamCount: 4, participantCount: 12 });

    const result = await t.run(async (ctx) => {
      const events = await ctx.db.query("events").collect();
      const teams = await ctx.db.query("teams").collect();
      const types = await ctx.db.query("event_types").collect();
      const revisions = await ctx.db.query("event_revisions").collect();
      const registrations = await ctx.db.query("registrations").collect();
      const dates = await ctx.db.query("event_dates").collect();
      const sessions = await ctx.db.query("sessions").collect();
      return { events, teams, types, revisions, registrations, dates, sessions };
    });

    expect(result.events).toHaveLength(10);
    expect(result.events.every(({ topicId }) => topicId !== undefined)).toBe(true);
    expect(result.teams.map(({ name }) => name).sort()).toEqual([
      "Community",
      "Conferences",
      "Course",
      "Network",
    ]);
    expect(result.types.map(({ slug }) => slug).sort()).toEqual([
      "conference",
      "course",
      "free-meetup",
      "network",
      "standard-event",
    ]);
    expect(new Set(result.events.map(({ status }) => status))).toEqual(
      new Set(["draft", "submitted", "published", "archived"]),
    );
    expect(result.events.some(({ occurrenceCount }) => occurrenceCount > 1)).toBe(true);
    expect(result.dates.some(({ status }) => status === "cancelled")).toBe(true);
    expect(result.sessions.length).toBeGreaterThan(10);
    expect(new Set(result.revisions.map(({ status }) => status))).toEqual(
      new Set(["submitted", "approved", "rejected"]),
    );
    expect(new Set(result.registrations.map(({ status }) => status))).toEqual(
      new Set(["pending", "accepted", "waitlisted", "rejected", "withdrawn"]),
    );

    await expect(
      t.mutation(internal.seed.demo, {
        organizationId: workspace.organizationId,
        actorIdentity,
      }),
    ).resolves.toEqual({ created: false, eventCount: 0, teamCount: 0, participantCount: 0 });

    await expect(
      t.mutation(internal.seed.resetAndReseed, {
        organizationId: workspace.organizationId,
        actorIdentity,
      }),
    ).resolves.toEqual({
      deleted: { eventCount: 9, participantCount: 12, templateCount: 2 },
      seeded: { created: true, eventCount: 9, teamCount: 4, participantCount: 12 },
    });

    const afterReset = await t.run(async (ctx) => ({
      events: await ctx.db.query("events").collect(),
      participants: await ctx.db.query("participants").collect(),
      templates: await ctx.db.query("signup_form_templates").collect(),
      seedAudits: (await ctx.db.query("audit_entries").collect()).filter(
        ({ action }) => action === "demo.seeded",
      ),
    }));
    expect(afterReset.events).toHaveLength(10);
    expect(afterReset.events.find(({ _id }) => _id === existing.eventId)?.title).toBe(
      "Existing Event",
    );
    expect(afterReset.participants).toHaveLength(12);
    expect(afterReset.templates).toHaveLength(2);
    expect(afterReset.seedAudits).toHaveLength(1);
  });
});
