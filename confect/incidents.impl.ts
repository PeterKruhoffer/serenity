import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import databaseSchema from "./_generated/schema";
import { DatabaseReader, DatabaseWriter } from "./_generated/services";
import incidents from "./incidents.spec";

const list = FunctionImpl.make(databaseSchema, incidents, "list", () =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;

    return yield* reader.table("incidents").index("by_creation_time", "desc").collect();
  }).pipe(Effect.orDie),
);

const create = FunctionImpl.make(
  databaseSchema,
  incidents,
  "create",
  ({ name, summary, region, severity, status }) =>
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;

      return yield* writer.table("incidents").insert({
        name,
        summary,
        region,
        severity,
        status,
        updatedAt: Date.now(),
      });
    }).pipe(Effect.orDie),
);

export default GroupImpl.make(databaseSchema, incidents).pipe(
  Layer.provide(list),
  Layer.provide(create),
  GroupImpl.finalize,
);
