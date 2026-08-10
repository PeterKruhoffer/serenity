import { FunctionSpec, GroupSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { Id } from "./_generated/id";

const Role = Schema.Literal("administrator", "super_user", "event_manager");

const TeamSummary = Schema.Struct({
  id: Id("teams"),
  name: Schema.String,
  slug: Schema.String,
});

const OrganizationWorkspace = Schema.Struct({
  id: Id("organizations"),
  name: Schema.String,
  slug: Schema.String,
  role: Role,
  teams: Schema.Array(TeamSummary),
});

const Workspace = Schema.Struct({
  viewer: Schema.Struct({
    displayName: Schema.String,
    email: Schema.optional(Schema.String),
  }),
  organizations: Schema.Array(OrganizationWorkspace),
});

export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()("Unauthenticated", {
  message: Schema.String,
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  message: Schema.String,
}) {}

export class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {
  message: Schema.String,
}) {}

const WorkspaceError = Schema.Union(Unauthenticated, Forbidden, Conflict, InvalidInput);

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => Schema.Struct({}),
      returns: () => Workspace,
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createOrganization",
      args: () =>
        Schema.Struct({
          organizationName: Schema.String,
          firstTeamName: Schema.String,
        }),
      returns: () =>
        Schema.Struct({
          organizationId: Id("organizations"),
          teamId: Id("teams"),
        }),
      error: () => WorkspaceError,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createTeam",
      args: () =>
        Schema.Struct({
          organizationId: Id("organizations"),
          name: Schema.String,
        }),
      returns: () => Schema.Struct({ teamId: Id("teams") }),
      error: () => WorkspaceError,
    }),
  );
