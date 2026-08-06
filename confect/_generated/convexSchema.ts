import { defineSchema as $defineSchema } from "convex/server";

import incidents from "./tables/incidents";

export default $defineSchema({
  incidents: incidents.tableDefinition,
});
