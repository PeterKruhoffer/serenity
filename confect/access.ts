import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Auth, DatabaseReader } from "./_generated/services";
import { Forbidden, Unauthenticated } from "./workspace.spec";

export const requireIdentity = (message: string) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.getUserIdentity.pipe(
      Effect.mapError(() => new Unauthenticated({ message })),
    );
  });

export const membershipFor = (organizationId: GenericId<"organizations">, identityToken: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const membership = yield* reader
      .table("organization_memberships")
      .get("by_organizationId_and_identityToken", organizationId, identityToken)
      .pipe(
        Effect.mapError(() => new Forbidden({ message: "You cannot access this organization." })),
      );
    if (membership.status !== "active") {
      return yield* Effect.fail(
        new Forbidden({ message: "Your organization access is suspended." }),
      );
    }
    return membership;
  });

export const canAccessTeam = (
  role: "administrator" | "super_user" | "event_manager",
  organizationId: GenericId<"organizations">,
  teamId: GenericId<"teams">,
  identityToken: string,
) =>
  Effect.gen(function* () {
    if (role !== "event_manager") return true;
    const reader = yield* DatabaseReader;
    const assignment = yield* reader
      .table("team_memberships")
      .index("by_teamId_and_identityToken", (q) =>
        q.eq("teamId", teamId).eq("identityToken", identityToken),
      )
      .first();
    return Option.isSome(assignment) && assignment.value.organizationId === organizationId;
  });

export const requireEventAccess = (eventId: GenericId<"events">, identityToken: string) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const event = yield* reader
      .table("events")
      .get(eventId)
      .pipe(Effect.mapError(() => new Forbidden({ message: "You cannot access this event." })));
    const membership = yield* membershipFor(event.organizationId, identityToken);
    const allowed = yield* canAccessTeam(
      membership.role,
      event.organizationId,
      event.teamId,
      identityToken,
    );
    if (!allowed) {
      return yield* Effect.fail(new Forbidden({ message: "You cannot access this event." }));
    }
    return { event, membership };
  });
