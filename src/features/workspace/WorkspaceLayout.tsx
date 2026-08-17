import { A, useLocation } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "convex-solidjs";
import {
  Match,
  Show,
  Switch,
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import { api } from "../../../convex/_generated/api";
import { FormError } from "../../components/form-error";
import { convexErrorMessage } from "../../lib/convex-error-message";

type WorkspaceData = FunctionReturnType<typeof api.workspace.list>;
type Organization = WorkspaceData["organizations"][number];

type WorkspaceContextValue = {
  workspace: Accessor<WorkspaceData>;
  activeOrganization: Accessor<Organization>;
};

const WorkspaceContext = createContext<WorkspaceContextValue>();

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within a WorkspaceLayout provider");
  return context;
};

const roleLabel = (role: Organization["role"]) =>
  ({ administrator: "Administrator", super_user: "Super user", event_manager: "Event manager" })[
    role
  ];

export default function WorkspaceLayout(props: { children?: JSX.Element }) {
  const location = useLocation();
  const workspaceQuery = useQuery(api.workspace.list, {});
  const createOrganization = useMutation(api.workspace.createOrganization);
  const [organizationName, setOrganizationName] = createSignal("");
  const [firstTeamName, setFirstTeamName] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
  const workspace = () => workspaceQuery.data()!;
  const activeOrganization = () => workspace().organizations[0]!;
  const isActive = (page: string) =>
    page === "events"
      ? ["/", "/events", "/callback"].includes(location.pathname)
      : location.pathname === `/${page}`;

  const setup = async (event: SubmitEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createOrganization.mutate({
        organizationName: organizationName(),
        firstTeamName: firstTeamName(),
      });
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };

  return (
    <Switch>
      <Match when={workspaceQuery.isLoading()}>
        <section class="workspace-state" aria-live="polite">
          <span class="loading-mark" aria-hidden="true" />
          <p>Opening your workspace…</p>
        </section>
      </Match>
      <Match when={workspaceQuery.error()}>
        <section class="workspace-state workspace-error" role="alert">
          <p class="eyebrow">Workspace unavailable</p>
          <h1>We couldn’t open Serenity.</h1>
          <p>{convexErrorMessage(workspaceQuery.error())}</p>
          <button class="secondary-button" type="button" onClick={workspaceQuery.refetch}>
            Try again
          </button>
        </section>
      </Match>
      <Match when={workspaceQuery.data()?.organizations.length === 0}>
        <section class="onboarding" aria-labelledby="onboarding-title">
          <div class="onboarding-copy">
            <p class="eyebrow">Create your workspace</p>
            <h1 id="onboarding-title">A calm place for every event.</h1>
            <p class="intro">
              Start with your organization and the first team responsible for delivering events.
            </p>
          </div>
          <form class="setup-form" onSubmit={setup}>
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
              <FormError>{formError()}</FormError>
            </Show>
            <button class="primary-button" type="submit" disabled={createOrganization.isLoading()}>
              {createOrganization.isLoading() ? "Creating workspace…" : "Create workspace"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      </Match>
      <Match when={workspaceQuery.data()}>
        <WorkspaceContext.Provider value={{ workspace, activeOrganization }}>
          <div class="workspace-layout">
            <aside class="workspace-sidebar" aria-label="Workspace navigation">
              <div>
                <p class="sidebar-label">Workspace</p>
                <strong>{activeOrganization().name}</strong>
                <span>{roleLabel(activeOrganization().role)}</span>
              </div>
              <nav>
                <A
                  class="nav-item"
                  classList={{ "is-active": isActive("events") }}
                  href="/events"
                  aria-current={isActive("events") ? "page" : undefined}
                >
                  <span aria-hidden="true">◫</span> Events
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": isActive("templates") }}
                  href="/templates"
                  aria-current={isActive("templates") ? "page" : undefined}
                >
                  <span aria-hidden="true">▤</span> Templates
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": isActive("approvals") }}
                  href="/approvals"
                  aria-current={isActive("approvals") ? "page" : undefined}
                >
                  <span aria-hidden="true">✓</span> Approvals
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": isActive("participants") }}
                  href="/participants"
                  aria-current={isActive("participants") ? "page" : undefined}
                >
                  <span aria-hidden="true">○</span> Participants
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": isActive("settings") }}
                  href="/settings"
                  aria-current={isActive("settings") ? "page" : undefined}
                >
                  <span aria-hidden="true">⌘</span> Settings
                </A>
              </nav>
            </aside>
            <section class="workspace-content">{props.children}</section>
          </div>
        </WorkspaceContext.Provider>
      </Match>
    </Switch>
  );
}
