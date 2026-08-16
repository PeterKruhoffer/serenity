import { GenericId } from "@confect/core";

export type TableNames = "audit_entries" | "date_declines" | "event_dates" | "event_revisions" | "event_type_versions" | "event_types" | "events" | "organization_memberships" | "organizations" | "participants" | "registration_answers" | "registrations" | "revision_dates" | "revision_sessions" | "revision_signup_fields" | "sessions" | "signup_form_fields" | "signup_form_templates" | "team_memberships" | "teams";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
