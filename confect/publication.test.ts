/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const startsAt = Date.UTC(2026, 9, 1, 8, 0);
const endsAt = Date.UTC(2026, 9, 1, 16, 0);

const setupSubmission = async () => {
  const t = convexTest(schema, modules);
  const authorToken = "issuer|author";
  const reviewerToken = "issuer|reviewer";
  const author = t.withIdentity({ tokenIdentifier: authorToken, name: "Event Author" });
  const reviewer = t.withIdentity({ tokenIdentifier: reviewerToken, name: "Review Lead" });
  const workspace = await author.mutation(api.workspace.createOrganization, {
    organizationName: "Publication Lab",
    firstTeamName: "Programs",
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("organization_memberships", {
      organizationId: workspace.organizationId,
      identityToken: reviewerToken,
      displayName: "Review Lead",
      role: "super_user",
      status: "active",
      joinedAt: Date.now(),
    });
  });
  const event = await author.mutation(api.events.create, {
    organizationId: workspace.organizationId,
    teamId: workspace.teamId,
    title: "Safety in Practice",
    description: "A complete publication workflow.",
    timezone: "UTC",
    firstDate: { startsAt, endsAt, venueName: "Learning Center" },
  });
  const submitted = await author.mutation(api.publication.submit, { eventId: event.eventId });
  return { t, author, reviewer, workspace, event, submitted };
};

describe("safe publication", () => {
  it("publishes an immutable approved snapshot while later draft work stays private", async () => {
    const { author, reviewer, workspace, event, submitted } = await setupSubmission();

    const pending = await reviewer.query(api.publication.listPending, {
      organizationId: workspace.organizationId,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ title: "Safety in Practice", revisionNumber: 1 });

    await reviewer.mutation(api.publication.approve, {
      revisionId: submitted.revisionId,
      note: "Ready to publish",
    });
    const published = await author.query(api.publication.getPublished, {
      eventId: event.eventId,
    });
    expect(published).toMatchObject({ version: 1, title: "Safety in Practice" });
    expect(published.dates).toHaveLength(1);

    await author.mutation(api.publication.startDraft, { eventId: event.eventId });
    await author.mutation(api.events.addDate, {
      eventId: event.eventId,
      date: {
        startsAt: startsAt + 86_400_000,
        endsAt: endsAt + 86_400_000,
        venueName: "Draft-only venue",
      },
    });
    const stillPublished = await author.query(api.publication.getPublished, {
      eventId: event.eventId,
    });
    expect(stillPublished.version).toBe(1);
    expect(stillPublished.dates).toHaveLength(1);
  });

  it("returns a rejected revision to an editable draft", async () => {
    const { author, reviewer, event, submitted } = await setupSubmission();
    await reviewer.mutation(api.publication.reject, {
      revisionId: submitted.revisionId,
      note: "Please add another date",
    });

    await expect(
      author.mutation(api.events.addDate, {
        eventId: event.eventId,
        date: {
          startsAt: startsAt + 86_400_000,
          endsAt: endsAt + 86_400_000,
          venueName: "Second venue",
        },
      }),
    ).resolves.toHaveProperty("eventDateId");
  });

  it("prevents authors from approving their own revisions", async () => {
    const { t, author, workspace, submitted } = await setupSubmission();
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("organization_memberships")
        .withIndex("by_organizationId_and_identityToken", (q) =>
          q.eq("organizationId", workspace.organizationId).eq("identityToken", "issuer|author"),
        )
        .unique();
      if (membership) await ctx.db.patch(membership._id, { role: "super_user" });
    });

    await expect(
      author.mutation(api.publication.approve, {
        revisionId: submitted.revisionId,
        note: "Self approval",
      }),
    ).rejects.toMatchObject({ data: { _tag: "Forbidden" } });
  });
});
