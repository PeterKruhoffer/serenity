import type { Document } from "@confect/server";
import type schemaDefinition from "./schema";

export type AuditEntriesDoc = Document.Document<typeof schemaDefinition, "audit_entries">;
export type OrganizationMembershipsDoc = Document.Document<typeof schemaDefinition, "organization_memberships">;
export type OrganizationsDoc = Document.Document<typeof schemaDefinition, "organizations">;
export type TeamMembershipsDoc = Document.Document<typeof schemaDefinition, "team_memberships">;
export type TeamsDoc = Document.Document<typeof schemaDefinition, "teams">;

export interface Docs {
  audit_entries: AuditEntriesDoc;
  organization_memberships: OrganizationMembershipsDoc;
  organizations: OrganizationsDoc;
  team_memberships: TeamMembershipsDoc;
  teams: TeamsDoc;
}
