import { defineSchema as $defineSchema } from "convex/server";

import audit_entries from "./tables/audit_entries";
import organization_memberships from "./tables/organization_memberships";
import organizations from "./tables/organizations";
import team_memberships from "./tables/team_memberships";
import teams from "./tables/teams";

export default $defineSchema({
  audit_entries: audit_entries.tableDefinition,
  organization_memberships: organization_memberships.tableDefinition,
  organizations: organizations.tableDefinition,
  team_memberships: team_memberships.tableDefinition,
  teams: teams.tableDefinition,
});
