/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("workspace boundaries", () => {
  it("bootstraps an administrator workspace and audits team creation", async () => {
    const t = convexTest(schema, modules);
    const administrator = t.withIdentity({
      tokenIdentifier: "https://api.workos.com/|user_admin",
      subject: "user_admin",
      name: "Alex Morgan",
      email: "alex@example.com",
    });

    expect(await administrator.query(api.workspace.list, {})).toMatchObject({
      viewer: { displayName: "Alex Morgan", email: "alex@example.com" },
      organizations: [],
    });

    const created = await administrator.mutation(api.workspace.createOrganization, {
      organizationName: "Northstar Learning",
      firstTeamName: "Programs",
    });
    await administrator.mutation(api.workspace.createTeam, {
      organizationId: created.organizationId,
      name: "Partnerships",
    });

    const workspace = await administrator.query(api.workspace.list, {});
    expect(workspace.organizations).toHaveLength(1);
    expect(workspace.organizations[0]).toMatchObject({
      name: "Northstar Learning",
      slug: "northstar-learning",
      role: "administrator",
    });
    expect(workspace.organizations[0]?.teams.map((team) => team.name)).toEqual([
      "Programs",
      "Partnerships",
    ]);

    const auditEntries = await t.run(async (ctx) =>
      ctx.db
        .query("audit_entries")
        .withIndex("by_organizationId_and_occurredAt", (q) =>
          q.eq("organizationId", created.organizationId),
        )
        .collect(),
    );
    expect(auditEntries.map((entry) => entry.action)).toEqual([
      "organization.created",
      "team.created",
    ]);
  });

  it("does not allow an unrelated identity to create a team", async () => {
    const t = convexTest(schema, modules);
    const administrator = t.withIdentity({ tokenIdentifier: "issuer|administrator" });
    const outsider = t.withIdentity({ tokenIdentifier: "issuer|outsider" });
    const created = await administrator.mutation(api.workspace.createOrganization, {
      organizationName: "Serenity Events",
      firstTeamName: "Events",
    });

    await expect(
      outsider.mutation(api.workspace.createTeam, {
        organizationId: created.organizationId,
        name: "Unauthorized team",
      }),
    ).rejects.toMatchObject({
      data: {
        _tag: "Forbidden",
        message: "You cannot manage teams in this organization.",
      },
    });
  });
});
