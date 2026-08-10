import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "./_generated/schema";
import { Auth, DatabaseReader, DatabaseWriter } from "./_generated/services";
import workspace from "./workspace.spec";
import { Conflict, Forbidden, InvalidInput, Unauthenticated } from "./workspace.spec";

const getIdentity = Effect.gen(function* () {
  const auth = yield* Auth;
  return yield* auth.getUserIdentity.pipe(
    Effect.mapError(() => new Unauthenticated({ message: "Sign in to open a workspace." })),
  );
});

const normalizeName = (value: string, label: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 80) {
    return Effect.fail(
      new InvalidInput({ message: `${label} must be between 2 and 80 characters.` }),
    );
  }
  return Effect.succeed(normalized);
};

const toSlug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "workspace";

const displayNameFor = (identity: {
  readonly name?: string;
  readonly email?: string;
  readonly subject: string;
}) => identity.name?.trim() || identity.email?.trim() || identity.subject;

const list = FunctionImpl.make(databaseSchema, workspace, "list", () =>
  Effect.gen(function* () {
    const identity = yield* getIdentity;
    const reader = yield* DatabaseReader;
    const memberships = yield* reader
      .table("organization_memberships")
      .index(
        "by_identityToken_and_status",
        (q) => q.eq("identityToken", identity.tokenIdentifier).eq("status", "active"),
        "asc",
      )
      .take(20);

    const organizations = yield* Effect.forEach(memberships, (membership) =>
      Effect.gen(function* () {
        const organization = yield* reader
          .table("organizations")
          .get(membership.organizationId)
          .pipe(Effect.option);
        if (Option.isNone(organization) || organization.value.status !== "active") return null;

        const teams =
          membership.role === "event_manager"
            ? yield* Effect.gen(function* () {
                const assignments = yield* reader
                  .table("team_memberships")
                  .index("by_organizationId_and_identityToken", (q) =>
                    q
                      .eq("organizationId", membership.organizationId)
                      .eq("identityToken", identity.tokenIdentifier),
                  )
                  .take(100);
                const assignedTeams = yield* Effect.forEach(assignments, (assignment) =>
                  reader.table("teams").get(assignment.teamId).pipe(Effect.option),
                );
                return assignedTeams.flatMap((team) =>
                  Option.isSome(team) && team.value.status === "active" ? [team.value] : [],
                );
              })
            : yield* reader
                .table("teams")
                .index("by_organizationId_and_status", (q) =>
                  q.eq("organizationId", membership.organizationId).eq("status", "active"),
                )
                .take(100);

        return {
          id: organization.value._id,
          name: organization.value.name,
          slug: organization.value.slug,
          role: membership.role,
          teams: teams.map((team) => ({ id: team._id, name: team.name, slug: team.slug })),
        } as const;
      }),
    );

    return {
      viewer: {
        displayName: displayNameFor(identity),
        ...(identity.email ? { email: identity.email } : {}),
      },
      organizations: organizations.filter((organization) => organization !== null),
    };
  }).pipe(Effect.catchTag("DocumentDecodeError", (error) => Effect.die(error))),
);

const createOrganization = FunctionImpl.make(
  databaseSchema,
  workspace,
  "createOrganization",
  ({ organizationName: rawOrganizationName, firstTeamName: rawFirstTeamName }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const organizationName = yield* normalizeName(rawOrganizationName, "Organization name");
      const firstTeamName = yield* normalizeName(rawFirstTeamName, "Team name");
      const existingMemberships = yield* reader
        .table("organization_memberships")
        .index(
          "by_identityToken_and_status",
          (q) => q.eq("identityToken", identity.tokenIdentifier).eq("status", "active"),
          "asc",
        )
        .take(1);

      if (existingMemberships.length > 0) {
        return yield* Effect.fail(
          new Conflict({ message: "Your account already has an active organization." }),
        );
      }

      const organizationSlug = toSlug(organizationName);
      const slugMatch = yield* reader
        .table("organizations")
        .index("by_slug", (q) => q.eq("slug", organizationSlug))
        .first();
      if (Option.isSome(slugMatch)) {
        return yield* Effect.fail(
          new Conflict({ message: "That organization name is already in use." }),
        );
      }

      const now = Date.now();
      const organizationId = yield* writer.table("organizations").insert({
        name: organizationName,
        slug: organizationSlug,
        status: "active",
        createdByIdentity: identity.tokenIdentifier,
        createdAt: now,
        updatedAt: now,
      });
      yield* writer.table("organization_memberships").insert({
        organizationId,
        identityToken: identity.tokenIdentifier,
        displayName: displayNameFor(identity),
        ...(identity.email ? { email: identity.email } : {}),
        role: "administrator",
        status: "active",
        joinedAt: now,
      });
      const teamId = yield* writer.table("teams").insert({
        organizationId,
        name: firstTeamName,
        slug: toSlug(firstTeamName),
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      yield* writer.table("audit_entries").insert({
        organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "organization.created",
        entityType: "organization",
        entityId: organizationId,
        summary: `Created ${organizationName} with the ${firstTeamName} team`,
        occurredAt: now,
      });

      return { organizationId, teamId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

const createTeam = FunctionImpl.make(
  databaseSchema,
  workspace,
  "createTeam",
  ({ organizationId, name: rawName }) =>
    Effect.gen(function* () {
      const identity = yield* getIdentity;
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const name = yield* normalizeName(rawName, "Team name");
      const membership = yield* reader
        .table("organization_memberships")
        .get("by_organizationId_and_identityToken", organizationId, identity.tokenIdentifier)
        .pipe(
          Effect.mapError(
            () => new Forbidden({ message: "You cannot manage teams in this organization." }),
          ),
        );
      if (membership.status !== "active" || membership.role !== "administrator") {
        return yield* Effect.fail(
          new Forbidden({ message: "Only organization administrators can create teams." }),
        );
      }

      const slug = toSlug(name);
      const existingTeam = yield* reader
        .table("teams")
        .index("by_organizationId_and_slug", (q) =>
          q.eq("organizationId", organizationId).eq("slug", slug),
        )
        .first();
      if (Option.isSome(existingTeam)) {
        return yield* Effect.fail(
          new Conflict({ message: "A team with that name already exists." }),
        );
      }

      const now = Date.now();
      const teamId = yield* writer.table("teams").insert({
        organizationId,
        name,
        slug,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      yield* writer.table("audit_entries").insert({
        organizationId,
        actorIdentity: identity.tokenIdentifier,
        action: "team.created",
        entityType: "team",
        entityId: teamId,
        summary: `Created the ${name} team`,
        occurredAt: now,
      });

      return { teamId };
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: (error) => Effect.die(error),
        DocumentEncodeError: (error) => Effect.die(error),
      }),
    ),
);

export default GroupImpl.make(databaseSchema, workspace).pipe(
  Layer.provide(list),
  Layer.provide(createOrganization),
  Layer.provide(createTeam),
  GroupImpl.finalize,
);
