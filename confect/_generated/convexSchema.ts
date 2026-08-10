import { defineSchema as $defineSchema } from "convex/server";

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

export default $defineSchema({
  audit_entries: audit_entries.tableDefinition,
  event_dates: event_dates.tableDefinition,
  event_type_versions: event_type_versions.tableDefinition,
  event_types: event_types.tableDefinition,
  events: events.tableDefinition,
  organization_memberships: organization_memberships.tableDefinition,
  organizations: organizations.tableDefinition,
  sessions: sessions.tableDefinition,
  team_memberships: team_memberships.tableDefinition,
  teams: teams.tableDefinition,
});
