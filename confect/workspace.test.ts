/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vite-plus/test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

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
      defaultTimezone: "Europe/Copenhagen",
    });
    await administrator.mutation(api.workspace.createTeam, {
      organizationId: created.organizationId,
      name: "Partnerships",
    });

    const workspace = await administrator.query(api.workspace.list, {});
    expect(workspace.organizations[0]).toMatchObject({
      name: "Northstar Learning",
      slug: "northstar-learning",
      defaultTimezone: "Europe/Copenhagen",
      role: "administrator",
    });
    expect(workspace.organizations[0]?.teams.map((team) => team.name)).toEqual([
      "Programs",
      "Partnerships",
    ]);

    await administrator.mutation(api.workspace.updateDefaultTimezone, {
      organizationId: created.organizationId,
      defaultTimezone: "America/New_York",
    });
    expect((await administrator.query(api.workspace.list, {})).organizations[0]).toMatchObject({
      defaultTimezone: "America/New_York",
    });
  });

  it("rejects invalid organization timezones", async () => {
    const t = convexTest(schema, modules);
    const administrator = t.withIdentity({ tokenIdentifier: "issuer|administrator" });

    await expect(
      administrator.mutation(api.workspace.createOrganization, {
        organizationName: "Timezone Test",
        firstTeamName: "Events",
        defaultTimezone: "Europe/Not_A_Real_Place",
      }),
    ).rejects.toMatchObject({ data: { _tag: "InvalidInput" } });
  });

  it("does not allow an unrelated identity to create a team", async () => {
    const t = convexTest(schema, modules);
    const administrator = t.withIdentity({ tokenIdentifier: "issuer|administrator" });
    const outsider = t.withIdentity({ tokenIdentifier: "issuer|outsider" });
    const created = await administrator.mutation(api.workspace.createOrganization, {
      organizationName: "Serenity Events",
      firstTeamName: "Events",
      defaultTimezone: "UTC",
    });

    await expect(
      outsider.mutation(api.workspace.createTeam, {
        organizationId: created.organizationId,
        name: "Unauthorized team",
      }),
    ).rejects.toMatchObject({
      data: { _tag: "Forbidden" },
    });
  });
});
