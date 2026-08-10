import { GenericId } from "@confect/core";

export type TableNames = "audit_entries" | "event_dates" | "event_type_versions" | "event_types" | "events" | "organization_memberships" | "organizations" | "sessions" | "team_memberships" | "teams";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
