/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const startsAt = Date.UTC(2026, 9, 1, 8, 0);
const endsAt = Date.UTC(2026, 9, 1, 16, 0);

const setupSubmission = async (
  reviewerRole: "administrator" | "super_user" = "super_user",
  authorRole: "administrator" | "super_user" = "administrator",
) => {
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
      role: reviewerRole,
      status: "active",
      joinedAt: Date.now(),
    });
    if (authorRole === "super_user") {
      const authorMembership = await ctx.db
        .query("organization_memberships")
        .withIndex("by_organizationId_and_identityToken", (q) =>
          q.eq("organizationId", workspace.organizationId).eq("identityToken", authorToken),
        )
        .unique();
      if (authorMembership) {
        await ctx.db.patch(authorMembership._id, { role: authorRole });
      }
    }
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

  it("allows an administrator to review and approve another author's revision", async () => {
    const { author, reviewer, workspace, event, submitted } =
      await setupSubmission("administrator");

    await expect(
      reviewer.query(api.publication.listPending, {
        organizationId: workspace.organizationId,
      }),
    ).resolves.toHaveLength(1);

    await expect(
      reviewer.mutation(api.publication.approve, {
        revisionId: submitted.revisionId,
        note: "Approved by an administrator",
      }),
    ).resolves.toEqual({ publishedVersion: 1 });

    await expect(
      author.query(api.publication.getPublished, { eventId: event.eventId }),
    ).resolves.toMatchObject({ version: 1, title: "Safety in Practice" });
  });

  it.each(["administrator", "super_user"] as const)(
    "keeps a %s author's submission pending until they explicitly approve it",
    async (authorRole) => {
      const { author, workspace, event, submitted } = await setupSubmission(
        "super_user",
        authorRole,
      );

      const beforeApproval = await author.query(api.events.list, {
        organizationId: workspace.organizationId,
      });
      expect(beforeApproval).toContainEqual(
        expect.objectContaining({ id: event.eventId, status: "submitted" }),
      );

      await expect(
        author.mutation(api.publication.approve, {
          revisionId: submitted.revisionId,
          note: "Explicit approval by the author",
        }),
      ).resolves.toEqual({ publishedVersion: 1 });

      await expect(
        author.query(api.publication.getPublished, { eventId: event.eventId }),
      ).resolves.toMatchObject({ version: 1, title: "Safety in Practice" });
    },
  );
});
