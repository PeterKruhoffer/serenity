import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import audit_entries from "./tables/audit_entries";
import event_dates from "./tables/event_dates";
import event_type_versions from "./tables/event_type_versions";
import event_types from "./tables/event_types";
import events from "./tables/events";
import organization_memberships from "./tables/organization_memberships";
import organizations from "./tables/organizations";
import sessions from "./tables/sessions";
import team_memberships from "./tables/team_memberships";
import teams from "./tables/teams";

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof audit_entries |
  typeof event_dates |
  typeof event_type_versions |
  typeof event_types |
  typeof events |
  typeof organization_memberships |
  typeof organizations |
  typeof sessions |
  typeof team_memberships |
  typeof teams
> = $DatabaseSchema.make({
  audit_entries,
  event_dates,
  event_type_versions,
  event_types,
  events,
  organization_memberships,
  organizations,
  sessions,
  team_memberships,
  teams,
});

export default databaseSchema;
