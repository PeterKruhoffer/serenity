import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

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

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof audit_entries |
  typeof date_declines |
  typeof event_dates |
  typeof event_revisions |
  typeof event_topics |
  typeof event_type_versions |
  typeof event_types |
  typeof events |
  typeof organization_memberships |
  typeof organizations |
  typeof participants |
  typeof registration_answers |
  typeof registrations |
  typeof revision_dates |
  typeof revision_sessions |
  typeof revision_signup_fields |
  typeof sessions |
  typeof signup_form_fields |
  typeof signup_form_templates |
  typeof team_memberships |
  typeof teams
> = $DatabaseSchema.make({
  audit_entries,
  date_declines,
  event_dates,
  event_revisions,
  event_topics,
  event_type_versions,
  event_types,
  events,
  organization_memberships,
  organizations,
  participants,
  registration_answers,
  registrations,
  revision_dates,
  revision_sessions,
  revision_signup_fields,
  sessions,
  signup_form_fields,
  signup_form_templates,
  team_memberships,
  teams,
});

export default databaseSchema;
