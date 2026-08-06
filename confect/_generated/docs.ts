import type { Document } from "@confect/server";
import type schemaDefinition from "./schema";

export type IncidentsDoc = Document.Document<typeof schemaDefinition, "incidents">;

export interface Docs {
  incidents: IncidentsDoc;
}
