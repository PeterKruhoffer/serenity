import { defineSchema as $defineSchema } from "convex/server";

import audit_entries from "./tables/audit_entries";
import date_declines from "./tables/date_declines";
import event_dates from "./tables/event_dates";
import event_revisions from "./tables/event_revisions";
import event_topics from "./tables/event_topics";
import event_type_versions from "./tables/event_type_versions";
import event_types from "./tables/event_types";
import events from "./tables/events";
import organization_memberships from "./tables/organization_memberships";
import organizations from "./tables/organizations";
import participants from "./tables/participants";
import registration_answers from "./tables/registration_answers";
import registrations from "./tables/registrations";
import revision_dates from "./tables/revision_dates";
import revision_sessions from "./tables/revision_sessions";
import revision_signup_fields from "./tables/revision_signup_fields";
import sessions from "./tables/sessions";
import signup_form_fields from "./tables/signup_form_fields";
import signup_form_templates from "./tables/signup_form_templates";
import team_memberships from "./tables/team_memberships";
import teams from "./tables/teams";
import webhook_deliveries from "./tables/webhook_deliveries";
import webhook_delivery_attempts from "./tables/webhook_delivery_attempts";
import webhook_endpoints from "./tables/webhook_endpoints";
import webhook_events from "./tables/webhook_events";

export default $defineSchema({
  audit_entries: audit_entries.tableDefinition,
  date_declines: date_declines.tableDefinition,
  event_dates: event_dates.tableDefinition,
  event_revisions: event_revisions.tableDefinition,
  event_topics: event_topics.tableDefinition,
  event_type_versions: event_type_versions.tableDefinition,
  event_types: event_types.tableDefinition,
  events: events.tableDefinition,
  organization_memberships: organization_memberships.tableDefinition,
  organizations: organizations.tableDefinition,
  participants: participants.tableDefinition,
  registration_answers: registration_answers.tableDefinition,
  registrations: registrations.tableDefinition,
  revision_dates: revision_dates.tableDefinition,
  revision_sessions: revision_sessions.tableDefinition,
  revision_signup_fields: revision_signup_fields.tableDefinition,
  sessions: sessions.tableDefinition,
  signup_form_fields: signup_form_fields.tableDefinition,
  signup_form_templates: signup_form_templates.tableDefinition,
  team_memberships: team_memberships.tableDefinition,
  teams: teams.tableDefinition,
  webhook_deliveries: webhook_deliveries.tableDefinition,
  webhook_delivery_attempts: webhook_delivery_attempts.tableDefinition,
  webhook_endpoints: webhook_endpoints.tableDefinition,
  webhook_events: webhook_events.tableDefinition,
});
