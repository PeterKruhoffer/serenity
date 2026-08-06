import type * as Ref from "@confect/core/Ref";
import { HttpClient } from "@confect/js";
import * as Effect from "effect/Effect";

import refs from "../../confect/_generated/refs";

const confectHttp = HttpClient.layer(import.meta.env.VITE_CONVEX_URL);
const createIncidentRef = refs.public.incidents.create;

export type CreateIncidentInput = Ref.Args<typeof createIncidentRef>;

export const listIncidents = HttpClient.HttpClient.pipe(
  Effect.flatMap((client) => client.query(refs.public.incidents.list, {})),
  Effect.provide(confectHttp),
);

export const createIncident = (input: CreateIncidentInput) =>
  HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.mutation(createIncidentRef, input)),
    Effect.provide(confectHttp),
  );
