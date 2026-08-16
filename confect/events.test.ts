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

  it("saves reusable sign-up templates and copies ordered fields into an event", async () => {
    const { manager, workspace } = await setup();
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
      teamId: workspace.teamId,
      name: "Workshop questions",
      scope: "team",
      fields,
    });
    const templates = await manager.query(api.events.listSignupTemplates, {
      organizationId: workspace.organizationId,
    });
    expect(templates).toEqual([
      {
        id: saved.templateId,
        teamId: workspace.teamId,
        name: "Workshop questions",
        scope: "team",
        fields,
      },
    ]);

    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
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
