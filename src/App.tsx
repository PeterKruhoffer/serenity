import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Match, Show, Switch, createSignal, type Component } from "solid-js";
import { useWorkOSAuth } from "./auth";

const roleLabel = (role: "administrator" | "super_user" | "event_manager") =>
  ({
    administrator: "Administrator",
    super_user: "Super user",
    event_manager: "Event manager",
  })[role];

const errorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
};

const Workspace: Component = () => {
  const workspace = useQuery(api.workspace.list, {});
  const createOrganization = useMutation(api.workspace.createOrganization);
  const createTeam = useMutation(api.workspace.createTeam);
  const [organizationName, setOrganizationName] = createSignal("");
  const [firstTeamName, setFirstTeamName] = createSignal("");
  const [newTeamName, setNewTeamName] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
  const [showTeamForm, setShowTeamForm] = createSignal(false);

  const handleOrganizationSetup = async (event: SubmitEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createOrganization.mutate({
        organizationName: organizationName(),
        firstTeamName: firstTeamName(),
      });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleTeamCreate = async (event: SubmitEvent, organizationId: Id<"organizations">) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createTeam.mutate({ organizationId, name: newTeamName() });
      setNewTeamName("");
      setShowTeamForm(false);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  return (
    <Switch>
      <Match when={workspace.isLoading()}>
        <section class="workspace-state" aria-live="polite">
          <span class="loading-mark" aria-hidden="true" />
          <p>Opening your workspace…</p>
        </section>
      </Match>

      <Match when={workspace.error()}>
        <section class="workspace-state workspace-error" role="alert">
          <p class="eyebrow">Workspace unavailable</p>
          <h1>We couldn’t open Serenity.</h1>
          <p>{errorMessage(workspace.error())}</p>
          <button class="secondary-button" type="button" onClick={workspace.refetch}>
            Try again
          </button>
        </section>
      </Match>

      <Match when={workspace.data()?.organizations.length === 0}>
        <section class="onboarding" aria-labelledby="onboarding-title">
          <div class="onboarding-copy">
            <p class="eyebrow">Create your workspace</p>
            <h1 id="onboarding-title">A calm place for every event.</h1>
            <p class="intro">
              Start with your organization and the first team responsible for delivering events.
            </p>
          </div>
          <form class="setup-form" onSubmit={handleOrganizationSetup}>
            <label>
              <span>Organization name</span>
              <input
                name="organizationName"
                autocomplete="organization"
                placeholder="Northstar Learning"
                value={organizationName()}
                onInput={(event) => setOrganizationName(event.currentTarget.value)}
                required
              />
            </label>
            <label>
              <span>First team</span>
              <input
                name="teamName"
                placeholder="Programs"
                value={firstTeamName()}
                onInput={(event) => setFirstTeamName(event.currentTarget.value)}
                required
              />
            </label>
            <Show when={formError()}>
              <p class="auth-error" role="alert">
                {formError()}
              </p>
            </Show>
            <button class="primary-button" type="submit" disabled={createOrganization.isLoading()}>
              {createOrganization.isLoading() ? "Creating workspace…" : "Create workspace"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      </Match>

      <Match when={workspace.data()}>
        {(data) => (
          <div class="workspace-layout">
            <aside class="workspace-sidebar" aria-label="Workspace navigation">
              <div>
                <p class="sidebar-label">Workspace</p>
                <strong>{data().organizations[0]?.name}</strong>
                <span>{roleLabel(data().organizations[0]?.role ?? "event_manager")}</span>
              </div>
              <nav>
                <a class="nav-item is-active" href="#events" aria-current="page">
                  <span aria-hidden="true">◫</span> Events
                </a>
                <a class="nav-item" href="#approvals">
                  <span aria-hidden="true">✓</span> Approvals
                </a>
                <a class="nav-item" href="#participants">
                  <span aria-hidden="true">○</span> Participants
                </a>
                <a class="nav-item" href="#settings">
                  <span aria-hidden="true">⌘</span> Settings
                </a>
              </nav>
            </aside>

            <section class="workspace-content" id="events" aria-labelledby="events-title">
              <div class="content-heading">
                <div>
                  <p class="eyebrow">Event operations</p>
                  <h1 id="events-title">
                    Good afternoon, {data().viewer.displayName.split(" ")[0]}.
                  </h1>
                  <p>Everything your teams are preparing, reviewing, and publishing.</p>
                </div>
                <button class="primary-button" type="button" disabled title="Available next">
                  New event <span aria-hidden="true">＋</span>
                </button>
              </div>

              <div class="metric-grid" aria-label="Workspace overview">
                <article>
                  <span>Active events</span>
                  <strong>0</strong>
                  <small>Ready for your first event</small>
                </article>
                <article>
                  <span>Awaiting review</span>
                  <strong>0</strong>
                  <small>No revisions waiting</small>
                </article>
                <article>
                  <span>Teams</span>
                  <strong>{data().organizations[0]?.teams.length ?? 0}</strong>
                  <small>In this organization</small>
                </article>
              </div>

              <section class="teams-section" aria-labelledby="teams-title">
                <div class="section-title-row">
                  <div>
                    <p class="eyebrow">Your boundaries</p>
                    <h2 id="teams-title">Teams</h2>
                  </div>
                  <Show when={data().organizations[0]?.role === "administrator"}>
                    <button
                      class="secondary-button compact-button"
                      type="button"
                      onClick={() => setShowTeamForm((visible) => !visible)}
                    >
                      {showTeamForm() ? "Cancel" : "Add team"}
                    </button>
                  </Show>
                </div>

                <Show when={showTeamForm() && data().organizations[0]}>
                  {(organization) => (
                    <form
                      class="inline-form"
                      onSubmit={(event) => handleTeamCreate(event, organization().id)}
                    >
                      <label>
                        <span class="sr-only">Team name</span>
                        <input
                          placeholder="Team name"
                          value={newTeamName()}
                          onInput={(event) => setNewTeamName(event.currentTarget.value)}
                          required
                          autofocus
                        />
                      </label>
                      <button
                        class="primary-button compact-button"
                        type="submit"
                        disabled={createTeam.isLoading()}
                      >
                        {createTeam.isLoading() ? "Adding…" : "Add team"}
                      </button>
                    </form>
                  )}
                </Show>
                <Show when={formError()}>
                  <p class="auth-error" role="alert">
                    {formError()}
                  </p>
                </Show>

                <div class="team-grid">
                  <For each={data().organizations[0]?.teams}>
                    {(team) => (
                      <article class="team-card">
                        <span class="team-monogram" aria-hidden="true">
                          {team.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <h3>{team.name}</h3>
                          <p>No events yet</p>
                        </div>
                        <span class="card-arrow" aria-hidden="true">
                          →
                        </span>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
};

const App: Component = () => {
  const auth = useWorkOSAuth();

  return (
    <div class="app">
      <header class="app-header">
        <a class="wordmark" href="/" aria-label="Serenity home">
          <span class="wordmark-mark" aria-hidden="true">
            S
          </span>
          <span>Serenity</span>
        </a>

        <Show
          when={auth.isAuthenticated()}
          fallback={
            <span class="status">
              <span class="status-dot" aria-hidden="true" />
              Secure workspace
            </span>
          }
        >
          <button class="text-button" type="button" onClick={auth.signOut}>
            Sign out
          </button>
        </Show>
      </header>

      <main class="app-main">
        <Switch>
          <Match when={!auth.isConfigured()}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Authentication setup</p>
              <h1 id="welcome-title">Connect WorkOS to continue.</h1>
              <p class="intro">
                Add the WorkOS client ID to this environment to enable Google and GitHub login.
              </p>
              <div class="setup-note" role="status">
                Missing <code>VITE_WORKOS_CLIENT_ID</code>
              </div>
            </section>
          </Match>

          <Match when={auth.isLoading()}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Securing your workspace</p>
              <h1 id="welcome-title">Checking your session…</h1>
              <p class="intro">Serenity is connecting WorkOS AuthKit to Convex.</p>
            </section>
          </Match>

          <Match when={auth.isAuthenticated()}>
            <Workspace />
          </Match>

          <Match when={true}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Your work, in one calm place</p>
              <h1 id="welcome-title">Start with what matters.</h1>
              <p class="intro">
                Sign in securely with Google or GitHub to open your Serenity workspace.
              </p>
              <div class="auth-actions">
                <button
                  class="primary-button"
                  type="button"
                  onClick={() => void auth.signIn("GoogleOAuth")}
                >
                  Continue with Google
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  onClick={() => void auth.signIn("GitHubOAuth")}
                >
                  Continue with GitHub
                </button>
                <button class="email-button" type="button" onClick={() => void auth.signIn()}>
                  Continue with email
                </button>
              </div>
              <Show when={auth.error()}>
                <p class="auth-error" role="alert">
                  {auth.error()}
                </p>
              </Show>
              <p class="auth-note">Authentication is securely handled by WorkOS AuthKit.</p>
            </section>
          </Match>
        </Switch>
      </main>

      <footer class="app-footer">
        <span>Serenity</span>
        <span>Solid · Vite+ · Convex · WorkOS</span>
      </footer>
    </div>
  );
};

export default App;
