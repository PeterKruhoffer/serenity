import { DatabaseSchema as $DatabaseSchema } from "@confect/server";

import incidents from "./tables/incidents";

const databaseSchema: $DatabaseSchema.DatabaseSchema<
  typeof incidents
> = $DatabaseSchema.make({
  incidents,
});

export default databaseSchema;
