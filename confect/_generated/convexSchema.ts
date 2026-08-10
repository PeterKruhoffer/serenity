import { defineSchema as $defineSchema } from "convex/server";

import audit_entries from "./tables/audit_entries";
import event_dates from "./tables/event_dates";
import event_revisions from "./tables/event_revisions";
import event_type_versions from "./tables/event_type_versions";
import event_types from "./tables/event_types";
import events from "./tables/events";
import organization_memberships from "./tables/organization_memberships";
import organizations from "./tables/organizations";
import revision_dates from "./tables/revision_dates";
import revision_sessions from "./tables/revision_sessions";
import sessions from "./tables/sessions";
import team_memberships from "./tables/team_memberships";
import teams from "./tables/teams";

export default $defineSchema({
  audit_entries: audit_entries.tableDefinition,
  event_dates: event_dates.tableDefinition,
  event_revisions: event_revisions.tableDefinition,
  event_type_versions: event_type_versions.tableDefinition,
  event_types: event_types.tableDefinition,
  events: events.tableDefinition,
  organization_memberships: organization_memberships.tableDefinition,
  organizations: organizations.tableDefinition,
  revision_dates: revision_dates.tableDefinition,
  revision_sessions: revision_sessions.tableDefinition,
  sessions: sessions.tableDefinition,
  team_memberships: team_memberships.tableDefinition,
  teams: teams.tableDefinition,
});
