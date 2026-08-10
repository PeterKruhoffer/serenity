import { GenericId } from "@confect/core";

export type TableNames = "audit_entries" | "date_declines" | "event_dates" | "event_revisions" | "event_type_versions" | "event_types" | "events" | "organization_memberships" | "organizations" | "participants" | "registrations" | "revision_dates" | "revision_sessions" | "sessions" | "team_memberships" | "teams";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
