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
      firstDate: {
        startsAt: dayOneStart,
        endsAt: dayOneEnd,
        venueName: "Harbor House",
      },
    });
    const secondDate = await manager.mutation(api.events.addDate, {
      eventId: created.eventId,
      date: {
        startsAt: dayOneStart + 86_400_000,
        endsAt: dayOneEnd + 86_400_000,
        venueName: "Harbor House",
      },
    });
    await manager.mutation(api.events.addSession, {
      eventDateId: secondDate.eventDateId,
      title: "Leading through change",
      startsAt: dayOneStart + 86_400_000 + 3_600_000,
      endsAt: dayOneStart + 86_400_000 + 7_200_000,
      roomName: "Studio 2",
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
    expect(auditActions).toContain("event.date_added");
    expect(auditActions).toContain("event.session_added");
  });

  it("keeps event details private from unrelated identities", async () => {
    const { t, manager, workspace } = await setup();
    const created = await manager.mutation(api.events.create, {
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      title: "Private Program",
      description: "",
      timezone: "UTC",
      firstDate: {
        startsAt: dayOneStart,
        endsAt: dayOneEnd,
        venueName: "Main Hall",
      },
    });
    const outsider = t.withIdentity({ tokenIdentifier: "issuer|outsider" });

    await expect(
      outsider.query(api.events.get, { eventId: created.eventId }),
    ).rejects.toMatchObject({ data: { _tag: "Forbidden" } });
  });
});
