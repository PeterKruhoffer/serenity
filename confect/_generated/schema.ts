import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import audit_entries from "./tables/audit_entries";
import organization_memberships from "./tables/organization_memberships";
import organizations from "./tables/organizations";
import team_memberships from "./tables/team_memberships";
import teams from "./tables/teams";

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof audit_entries |
  typeof organization_memberships |
  typeof organizations |
  typeof team_memberships |
  typeof teams
> = $DatabaseSchema.make({
  audit_entries,
  organization_memberships,
  organizations,
  team_memberships,
  teams,
});

export default databaseSchema;
