import styles from "./workspace.module.css";
import { A, useLocation } from "@solidjs/router";
import { useMutation, useQuery } from "convex-solidjs";
import { Match, Show, Switch, createSignal, type JSX } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { FormError } from "../../components/form-error";
import { TimezoneTypeahead } from "../../components/timezone-typeahead";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { browserTimezone } from "../../lib/date-time";
import CommandPalette from "../command-palette/CommandPalette";
import { WorkspaceContext, type Organization } from "./WorkspaceContext";

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
  const [defaultTimezone, setDefaultTimezone] = createSignal(browserTimezone());
  const [formError, setFormError] = createSignal<string | null>(null);
  const workspace = () => workspaceQuery.data()!;
  const activeOrganization = () => workspace().organizations[0]!;
  const isActive = (page: string) =>
    page === "events"
      ? location.pathname === "/" ||
        location.pathname === "/callback" ||
        location.pathname.startsWith("/events")
      : location.pathname === `/${page}` || location.pathname.startsWith(`/${page}/`);

  const setup = async (event: SubmitEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createOrganization.mutate({
        organizationName: organizationName(),
        firstTeamName: firstTeamName(),
        defaultTimezone: defaultTimezone(),
      });
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };

  return (
    <Switch>
      <Match when={workspaceQuery.isLoading()}>
        <section class={styles.workspaceState} aria-live="polite">
          <span class={styles.loadingMark} aria-hidden="true" />
          <p>Opening your workspace…</p>
        </section>
      </Match>
      <Match when={workspaceQuery.error()}>
        <section class={`${styles.workspaceState} ${styles.workspaceError}`} role="alert">
          <p class="eyebrow">Workspace unavailable</p>
          <h1>We couldn’t open Serenity.</h1>
          <p>{convexErrorMessage(workspaceQuery.error())}</p>
          <button class="secondary-button" type="button" onClick={workspaceQuery.refetch}>
            Try again
          </button>
        </section>
      </Match>
      <Match when={workspaceQuery.data()?.organizations.length === 0}>
        <section class={styles.onboarding} aria-labelledby="onboarding-title">
          <div class={styles.onboardingCopy}>
            <p class="eyebrow">Create your workspace</p>
            <h1 id="onboarding-title">A calm place for every event.</h1>
            <p class="intro">
              Start with your organization and the first team responsible for delivering events.
            </p>
          </div>
          <form class={styles.setupForm} onSubmit={setup}>
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
            <label>
              <span>Default event timezone</span>
              <TimezoneTypeahead
                name="defaultTimezone"
                value={defaultTimezone()}
                onChange={setDefaultTimezone}
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
          <div class={styles.workspaceLayout}>
            <aside class={styles.workspaceSidebar} aria-label="Workspace navigation">
              <div>
                <p class={styles.sidebarLabel}>Workspace</p>
                <strong>{activeOrganization().name}</strong>
                <span>{roleLabel(activeOrganization().role)}</span>
              </div>
              <CommandPalette />
              <nav>
                <A
                  class={styles.navItem}
                  classList={{ [styles.isActive]: isActive("events") }}
                  href="/events"
                  aria-current={isActive("events") ? "page" : undefined}
                >
                  <span aria-hidden="true">◫</span> Events
                </A>
                <A
                  class={styles.navItem}
                  classList={{ [styles.isActive]: isActive("calendar") }}
                  href="/calendar"
                  aria-current={isActive("calendar") ? "page" : undefined}
                >
                  <span aria-hidden="true">□</span> Calendar
                </A>
                <A
                  class={styles.navItem}
                  classList={{ [styles.isActive]: isActive("templates") }}
                  href="/templates"
                  aria-current={isActive("templates") ? "page" : undefined}
                >
                  <span aria-hidden="true">▤</span> Templates
                </A>
                <A
                  class={styles.navItem}
                  classList={{ [styles.isActive]: isActive("approvals") }}
                  href="/approvals"
                  aria-current={isActive("approvals") ? "page" : undefined}
                >
                  <span aria-hidden="true">✓</span> Approvals
                </A>
                <A
                  class={styles.navItem}
                  classList={{ [styles.isActive]: isActive("participants") }}
                  href="/participants"
                  aria-current={isActive("participants") ? "page" : undefined}
                >
                  <span aria-hidden="true">○</span> Participants
                </A>
                <A
                  class={styles.navItem}
                  classList={{ [styles.isActive]: isActive("settings") }}
                  href="/settings"
                  aria-current={isActive("settings") ? "page" : undefined}
                >
                  <span aria-hidden="true">⌘</span> Settings
                </A>
              </nav>
            </aside>
            <section class={styles.workspaceContent}>{props.children}</section>
          </div>
        </WorkspaceContext.Provider>
      </Match>
    </Switch>
  );
}
