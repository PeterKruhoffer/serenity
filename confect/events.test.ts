/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const dayOneStart = Date.UTC(2026, 8, 10, 8, 0);
const dayOneEnd = Date.UTC(2026, 8, 10, 16, 0);

const setup = async () => {
  const t = convexTest(schema, modules);
  const manager = t.withIdentity({
    tokenIdentifier: "issuer|manager",
    name: "Morgan Lee",
  });
  const workspace = await manager.mutation(api.workspace.createOrganization, {
    organizationName: "Learning Guild",
    firstTeamName: "Academy",
    defaultTimezone: "Europe/Copenhagen",
  });
  return { t, manager, workspace };
};

describe("recurring event composition", () => {
  it("creates an event with dates and sessions and keeps its counts in sync", async () => {
    const { t, manager, workspace } = await setup();
    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Leadership Essentials",
      description: "A practical two-day course.",
      timezone: "Europe/Copenhagen",
      dates: [
        {
          startsAt: dayOneStart,
          endsAt: dayOneEnd,
          venueName: "Harbor House",
          sessions: [],
        },
        {
          startsAt: dayOneStart + 86_400_000,
          endsAt: dayOneEnd + 86_400_000,
          venueName: "Harbor House",
          sessions: [
            {
              title: "Leading through change",
              startsAt: dayOneStart + 86_400_000 + 3_600_000,
              endsAt: dayOneStart + 86_400_000 + 7_200_000,
              roomName: "Studio 2",
            },
          ],
        },
      ],
    });

    const detail = await manager.query(api.events.get, { eventId: created.eventId });
    expect(detail.event).toMatchObject({
      title: "Leadership Essentials",
      status: "draft",
      occurrenceCount: 2,
      sessionCount: 1,
    });
    expect(detail.dates).toHaveLength(2);
    expect(detail.dates[1]?.sessions[0]).toMatchObject({
      title: "Leading through change",
      roomName: "Studio 2",
    });

    const listed = await manager.query(api.events.list, {
      organizationId: workspace.organizationId,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ occurrenceCount: 2, sessionCount: 1 });

    const auditActions = await t.run(async (ctx) => {
      const entries = await ctx.db
        .query("audit_entries")
        .withIndex("by_organizationId_and_occurredAt", (q) =>
          q.eq("organizationId", workspace.organizationId),
        )
        .collect();
      return entries.map((entry) => entry.action);
    });
    expect(auditActions).toContain("event.created");
  });

  it("rejects event shapes that cannot be read back completely", async () => {
    const { manager, workspace } = await setup();

    await expect(
      manager.mutation(api.events.create, {
        organizationId: workspace.organizationId,
        teamId: workspace.teamId,
        title: "Oversized Program",
        description: "",
        timezone: "UTC",
        dates: Array.from({ length: 101 }, (_, index) => ({
          startsAt: dayOneStart + index * 86_400_000,
          endsAt: dayOneEnd + index * 86_400_000,
          venueName: "Main Hall",
          sessions: [],
        })),
      }),
    ).rejects.toMatchObject({ data: { _tag: "InvalidInput" } });
  });

  it("keeps an event's timezone when the organization default changes", async () => {
    const { manager, workspace } = await setup();
    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Timezone-specific Event",
      description: "",
      timezone: "America/New_York",
      dates: [
        {
          startsAt: dayOneStart,
          endsAt: dayOneEnd,
          venueName: "Main Hall",
          sessions: [],
        },
      ],
    });

    await manager.mutation(api.workspace.updateDefaultTimezone, {
      organizationId: workspace.organizationId,
      defaultTimezone: "Asia/Tokyo",
    });
    expect((await manager.query(api.events.get, { eventId: created.eventId })).event.timezone).toBe(
      "America/New_York",
    );
  });

  it("lists authorized overlapping calendar occurrences and applies team filters", async () => {
    const { t, manager, workspace } = await setup();
    const secondTeam = await manager.mutation(api.workspace.createTeam, {
      organizationId: workspace.organizationId,
      name: "Community",
    });
    const rangeStart = Date.UTC(2026, 8, 10);
    const rangeEnd = Date.UTC(2026, 8, 17);
    const createCalendarEvent = (
      title: string,
      teamId: typeof workspace.teamId,
      startsAt: number,
      endsAt: number,
    ) =>
      manager.mutation(api.events.create, {
        organizationId: workspace.organizationId,
        teamId,
        title,
        description: "",
        timezone: "UTC",
        dates: [{ startsAt, endsAt, venueName: "Main Hall", sessions: [] }],
      });
    const overlapping = await createCalendarEvent(
      "Overlapping draft",
      workspace.teamId,
      rangeStart - 3_600_000,
      rangeStart + 3_600_000,
    );
    const submitted = await createCalendarEvent(
      "Submitted event",
      workspace.teamId,
      rangeStart + 86_400_000,
      rangeStart + 90_000_000,
    );
    const published = await createCalendarEvent(
      "Published event",
      secondTeam.teamId,
      rangeStart + 2 * 86_400_000,
      rangeStart + 2 * 86_400_000 + 3_600_000,
    );
    const archived = await createCalendarEvent(
      "Archived event",
      workspace.teamId,
      rangeStart + 3 * 86_400_000,
      rangeStart + 3 * 86_400_000 + 3_600_000,
    );
    await createCalendarEvent(
      "Ends at boundary",
      workspace.teamId,
      rangeStart - 3_600_000,
      rangeStart,
    );
    await createCalendarEvent(
      "Starts at boundary",
      workspace.teamId,
      rangeEnd,
      rangeEnd + 3_600_000,
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(submitted.eventId, { status: "submitted" });
      await ctx.db.patch(published.eventId, { status: "published" });
      await ctx.db.patch(archived.eventId, { status: "archived" });
      const overlappingDate = await ctx.db
        .query("event_dates")
        .withIndex("by_eventId_and_sortOrder", (q) => q.eq("eventId", overlapping.eventId))
        .unique();
      if (overlappingDate) await ctx.db.patch(overlappingDate._id, { status: "cancelled" });
    });

    const all = await manager.query(api.events.listCalendarOccurrences, {
      organizationId: workspace.organizationId,
      rangeStart,
      rangeEnd,
    });
    expect(all.map((occurrence) => occurrence.eventTitle)).toEqual([
      "Overlapping draft",
      "Submitted event",
      "Published event",
    ]);
    expect(all[0]).toMatchObject({
      eventStatus: "draft",
      occurrenceStatus: "cancelled",
      teamName: "Academy",
    });

    const communityOnly = await manager.query(api.events.listCalendarOccurrences, {
      organizationId: workspace.organizationId,
      rangeStart,
      rangeEnd,
      teamId: secondTeam.teamId,
    });
    expect(communityOnly.map((occurrence) => occurrence.eventTitle)).toEqual(["Published event"]);

    const eventManagerToken = "issuer|calendar-manager";
    await t.run(async (ctx) => {
      await ctx.db.insert("organization_memberships", {
        organizationId: workspace.organizationId,
        identityToken: eventManagerToken,
        displayName: "Calendar Manager",
        role: "event_manager",
        status: "active",
        joinedAt: Date.now(),
      });
      await ctx.db.insert("team_memberships", {
        organizationId: workspace.organizationId,
        teamId: workspace.teamId,
        identityToken: eventManagerToken,
        assignedAt: Date.now(),
      });
    });
    const eventManager = t.withIdentity({ tokenIdentifier: eventManagerToken });
    expect(
      (
        await eventManager.query(api.events.listCalendarOccurrences, {
          organizationId: workspace.organizationId,
          rangeStart,
          rangeEnd,
        })
      ).map((occurrence) => occurrence.eventTitle),
    ).toEqual(["Overlapping draft", "Submitted event"]);
    await expect(
      eventManager.query(api.events.listCalendarOccurrences, {
        organizationId: workspace.organizationId,
        rangeStart,
        rangeEnd,
        teamId: secondTeam.teamId,
      }),
    ).rejects.toMatchObject({ data: { _tag: "Forbidden" } });
  });

  it("keeps event details private from unrelated identities", async () => {
    const { t, manager, workspace } = await setup();
    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Private Program",
      description: "",
      timezone: "UTC",
      dates: [
        {
          startsAt: dayOneStart,
          endsAt: dayOneEnd,
          venueName: "Main Hall",
          sessions: [],
        },
      ],
    });
    const outsider = t.withIdentity({ tokenIdentifier: "issuer|outsider" });

    await expect(
      outsider.query(api.events.get, { eventId: created.eventId }),
    ).rejects.toMatchObject({ data: { _tag: "Forbidden" } });
  });

  it("shares organization sign-up templates with events owned by any team", async () => {
    const { manager, workspace } = await setup();
    const secondTeam = await manager.mutation(api.workspace.createTeam, {
      organizationId: workspace.organizationId,
      name: "Community",
    });
    const fields = [
      {
        type: "textarea" as const,
        label: "What do you hope to learn?",
        required: true,
        options: [],
      },
      {
        type: "checkboxes" as const,
        label: "Dietary requirements",
        required: false,
        options: ["Vegetarian", "Vegan", "Gluten-free"],
      },
    ];

    const saved = await manager.mutation(api.events.saveSignupTemplate, {
      organizationId: workspace.organizationId,
      name: "Workshop questions",
      scope: "organization",
      fields,
    });
    const templates = await manager.query(api.events.listSignupTemplates, {
      organizationId: workspace.organizationId,
    });
    expect(templates).toEqual([
      {
        id: saved.templateId,
        name: "Workshop questions",
        scope: "organization",
        fields,
      },
    ]);

    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: secondTeam.teamId,
      title: "Custom Registration Workshop",
      description: "",
      timezone: "UTC",
      dates: [
        {
          startsAt: dayOneStart,
          endsAt: dayOneEnd,
          venueName: "Main Hall",
          sessions: [],
        },
      ],
      signupFields: templates[0]!.fields,
    });
    const detail = await manager.query(api.events.get, { eventId: created.eventId });
    expect(detail.signupFields).toEqual(fields);
  });

  it("updates and deletes templates without changing forms copied into events", async () => {
    const { manager, workspace } = await setup();
    const originalFields = [
      {
        type: "text" as const,
        label: "Job title",
        required: true,
        options: [],
        section: "About you",
      },
    ];
    const saved = await manager.mutation(api.events.saveSignupTemplate, {
      organizationId: workspace.organizationId,
      name: "Standard questions",
      scope: "organization",
      fields: originalFields,
    });
    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Existing Event",
      description: "",
      timezone: "UTC",
      dates: [
        {
          startsAt: dayOneStart,
          endsAt: dayOneEnd,
          venueName: "Main Hall",
          sessions: [],
        },
      ],
      signupFields: originalFields,
    });

    await manager.mutation(api.events.updateSignupTemplate, {
      templateId: saved.templateId,
      teamId: workspace.teamId,
      name: "Academy questions",
      scope: "team",
      fields: [
        {
          type: "yes_no",
          label: "Do you need accommodation?",
          required: false,
          options: [],
        },
      ],
    });
    expect(
      await manager.query(api.events.listSignupTemplates, {
        organizationId: workspace.organizationId,
      }),
    ).toMatchObject([
      {
        id: saved.templateId,
        teamId: workspace.teamId,
        name: "Academy questions",
        scope: "team",
        fields: [{ label: "Do you need accommodation?" }],
      },
    ]);
    expect(
      (await manager.query(api.events.get, { eventId: created.eventId })).signupFields,
    ).toEqual(originalFields);

    await manager.mutation(api.events.deleteSignupTemplate, { templateId: saved.templateId });
    expect(
      await manager.query(api.events.listSignupTemplates, {
        organizationId: workspace.organizationId,
      }),
    ).toEqual([]);
    expect(
      (await manager.query(api.events.get, { eventId: created.eventId })).signupFields,
    ).toEqual(originalFields);
  });

  it("lets event managers use but not manage organization templates", async () => {
    const { t, manager, workspace } = await setup();
    const fields = [
      {
        type: "text" as const,
        label: "Job title",
        required: true,
        options: [],
      },
    ];
    const saved = await manager.mutation(api.events.saveSignupTemplate, {
      organizationId: workspace.organizationId,
      name: "Organization questions",
      scope: "organization",
      fields,
    });
    const eventManagerToken = "issuer|event-manager";
    await t.run(async (ctx) => {
      await ctx.db.insert("organization_memberships", {
        organizationId: workspace.organizationId,
        identityToken: eventManagerToken,
        displayName: "Event Manager",
        role: "event_manager",
        status: "active",
        joinedAt: Date.now(),
      });
      await ctx.db.insert("team_memberships", {
        organizationId: workspace.organizationId,
        teamId: workspace.teamId,
        identityToken: eventManagerToken,
        assignedAt: Date.now(),
      });
    });
    const eventManager = t.withIdentity({ tokenIdentifier: eventManagerToken });

    expect(
      await eventManager.query(api.events.listSignupTemplates, {
        organizationId: workspace.organizationId,
      }),
    ).toMatchObject([{ id: saved.templateId, scope: "organization" }]);
    await expect(
      eventManager.mutation(api.events.updateSignupTemplate, {
        templateId: saved.templateId,
        name: "Changed questions",
        scope: "organization",
        fields,
      }),
    ).rejects.toMatchObject({ data: { _tag: "Forbidden" } });
    await expect(
      eventManager.mutation(api.events.deleteSignupTemplate, { templateId: saved.templateId }),
    ).rejects.toMatchObject({ data: { _tag: "Forbidden" } });
  });

  it("rejects invalid checkbox definitions", async () => {
    const { manager, workspace } = await setup();

    await expect(
      manager.mutation(api.events.saveSignupTemplate, {
        organizationId: workspace.organizationId,
        teamId: workspace.teamId,
        name: "Broken template",
        scope: "team",
        fields: [
          {
            type: "checkboxes",
            label: "Choose one",
            required: true,
            options: [],
          },
        ],
      }),
    ).rejects.toMatchObject({ data: { _tag: "InvalidInput" } });
  });
});
