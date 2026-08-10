import { GenericId } from "@confect/core";

export type TableNames = "audit_entries" | "organization_memberships" | "organizations" | "team_memberships" | "teams";

export const Id = <const TableName extends TableNames>(
  tableName: TableName,
) => GenericId.GenericId(tableName);
