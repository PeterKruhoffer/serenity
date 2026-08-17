# Backend architecture

`confect/` is the source of truth for the application backend. Confect generates the thin Convex
entry points in `convex/`; do not hand-edit generated files.

## Where behavior lives

- `tables/`: one Confect table definition per file. Indexes live with their table.
- `<feature>.spec.ts`: the feature's public or internal function interface and Effect schemas.
- `<feature>.impl.ts`: the corresponding transactions, authorization calls, and domain behavior.
- `<feature>.test.ts`: integration tests against the generated Convex functions.
- `access.ts`: the shared authenticated organization, team, and event access policy.
- `auth.ts`: WorkOS JWT provider configuration.
- `http.ts` and `publicApi.ts`: HTTP routing and request-boundary validation.
- `_generated/`: Confect output. Regenerate it; never edit it directly.

The current feature groups are:

- `workspace`: organizations, teams, and the signed-in viewer's workspace.
- `events`: draft events, dates, sessions, and sign-up form templates.
- `publication`: immutable review snapshots and publication workflow.
- `registrations`: organizer-side registration management.
- `attendee`: public event snapshots and attendee registration capabilities.

## Convex boundary

`convex/schema.ts`, function modules, `auth.config.ts`, and `http.ts` are generated adapters over
Confect. `convex/convex.config.ts` owns mounted components and typed environment declarations.
Run both generators after changing tables, specs, implementations, or component configuration:

```sh
vp run confect:codegen
vp exec convex codegen
```

Use `FunctionSpec.internal*` unless a browser or external client must call a function directly.
Public functions must authenticate and authorize in their implementation, except for the explicitly
public attendee surface. Guest attendee keys are 256-bit random capability tokens; authenticated
attendees are keyed by Convex's `identity.tokenIdentifier`.

## Verification

```sh
vp run check
```
