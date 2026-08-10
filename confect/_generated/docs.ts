import type { Document } from "@confect/server";
import type schemaDefinition from "./schema";

export type AuditEntriesDoc = Document.Document<typeof schemaDefinition, "audit_entries">;
export type EventDatesDoc = Document.Document<typeof schemaDefinition, "event_dates">;
export type EventRevisionsDoc = Document.Document<typeof schemaDefinition, "event_revisions">;
export type EventTypeVersionsDoc = Document.Document<typeof schemaDefinition, "event_type_versions">;
export type EventTypesDoc = Document.Document<typeof schemaDefinition, "event_types">;
export type EventsDoc = Document.Document<typeof schemaDefinition, "events">;
export type OrganizationMembershipsDoc = Document.Document<typeof schemaDefinition, "organization_memberships">;
export type OrganizationsDoc = Document.Document<typeof schemaDefinition, "organizations">;
export type RevisionDatesDoc = Document.Document<typeof schemaDefinition, "revision_dates">;
export type RevisionSessionsDoc = Document.Document<typeof schemaDefinition, "revision_sessions">;
export type SessionsDoc = Document.Document<typeof schemaDefinition, "sessions">;
export type TeamMembershipsDoc = Document.Document<typeof schemaDefinition, "team_memberships">;
export type TeamsDoc = Document.Document<typeof schemaDefinition, "teams">;

export interface Docs {
  audit_entries: AuditEntriesDoc;
  event_dates: EventDatesDoc;
  event_revisions: EventRevisionsDoc;
  event_type_versions: EventTypeVersionsDoc;
  event_types: EventTypesDoc;
  events: EventsDoc;
  organization_memberships: OrganizationMembershipsDoc;
  organizations: OrganizationsDoc;
  revision_dates: RevisionDatesDoc;
  revision_sessions: RevisionSessionsDoc;
  sessions: SessionsDoc;
  team_memberships: TeamMembershipsDoc;
  teams: TeamsDoc;
}
