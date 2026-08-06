import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";

import { Id } from "./_generated/id";
import incidents from "./_generated/tables/incidents";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => Schema.Struct({}),
      returns: () => Schema.Array(incidents.Doc),
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () =>
        Schema.Struct({
          name: Schema.String,
          summary: Schema.String,
          region: Schema.String,
          severity: Schema.Literal("critical", "high", "medium"),
          status: Schema.Literal("active", "investigating", "contained"),
        }),
      returns: () => Id("incidents"),
    }),
  );
