import styles from "./settings.module.css";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { TimezoneTypeahead } from "../../components/timezone-typeahead";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { useWorkspace } from "../workspace/WorkspaceLayout";

export default function SettingsPage() {
  const { activeOrganization } = useWorkspace();
  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const createTeam = useMutation(api.workspace.createTeam);
  const updateDefaultTimezone = useMutation(api.workspace.updateDefaultTimezone);
  const [newTeamName, setNewTeamName] = createSignal("");
  const [defaultTimezone, setDefaultTimezone] = createSignal(activeOrganization().defaultTimezone);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [timezoneError, setTimezoneError] = createSignal<string | null>(null);
  const [showTeamForm, setShowTeamForm] = createSignal(false);

  const handleTeamCreate = async (event: SubmitEvent, organizationId: Id<"organizations">) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createTeam.mutate({ organizationId, name: newTeamName() });
      setNewTeamName("");
      setShowTeamForm(false);
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };

  const handleTimezoneUpdate = async (event: SubmitEvent) => {
    event.preventDefault();
    setTimezoneError(null);
    try {
      await updateDefaultTimezone.mutate({
        organizationId: activeOrganization().id,
        defaultTimezone: defaultTimezone(),
      });
    } catch (error) {
      setTimezoneError(convexErrorMessage(error));
    }
  };

  return (
    <Page.Root labelledBy="settings-page-title">
      <Page.Header variant="page">
        <Page.Heading>
          <Page.Eyebrow>Workspace administration</Page.Eyebrow>
          <Page.Title id="settings-page-title">Settings</Page.Title>
          <Page.Description>
            Manage the teams that own and deliver your organization’s events.
          </Page.Description>
        </Page.Heading>
      </Page.Header>
      <section class={styles.organizationSection} aria-labelledby="organization-settings-title">
        <SectionHeader.Root>
          <SectionHeader.Heading>
            <SectionHeader.Eyebrow>Organization defaults</SectionHeader.Eyebrow>
            <SectionHeader.Title id="organization-settings-title">
              Event timezone
            </SectionHeader.Title>
          </SectionHeader.Heading>
        </SectionHeader.Root>
        <p class={styles.settingDescription}>
          New events start in this timezone. Changing it does not alter existing events.
        </p>
        <Show
          when={activeOrganization().role === "administrator"}
          fallback={<p class={styles.settingValue}>{activeOrganization().defaultTimezone}</p>}
        >
          <form class={styles.timezoneForm} onSubmit={handleTimezoneUpdate}>
            <label>
              <span>Default timezone</span>
              <TimezoneTypeahead value={defaultTimezone()} onChange={setDefaultTimezone} />
            </label>
            <button
              class="primary-button compact-button"
              type="submit"
              disabled={updateDefaultTimezone.isLoading()}
            >
              {updateDefaultTimezone.isLoading() ? "Saving…" : "Save timezone"}
            </button>
          </form>
        </Show>
        <Show when={timezoneError()}>
          <FormError>{timezoneError()}</FormError>
        </Show>
      </section>
      <section class={styles.teamsSection} aria-labelledby="teams-title">
        <SectionHeader.Root>
          <SectionHeader.Heading>
            <SectionHeader.Eyebrow>Your boundaries</SectionHeader.Eyebrow>
            <SectionHeader.Title id="teams-title">Teams</SectionHeader.Title>
          </SectionHeader.Heading>
          <Show when={activeOrganization()?.role === "administrator"}>
            <button
              class="secondary-button compact-button"
              type="button"
              onClick={() => setShowTeamForm((visible) => !visible)}
            >
              {showTeamForm() ? "Cancel" : "Add team"}
            </button>
          </Show>
        </SectionHeader.Root>
        <Show when={showTeamForm() && activeOrganization()}>
          {(organization) => (
            <form
              class={styles.inlineForm}
              onSubmit={(event) => handleTeamCreate(event, organization().id)}
            >
              <label>
                <span class={styles.srOnly}>Team name</span>
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
          <FormError>{formError()}</FormError>
        </Show>
        <div class={styles.teamGrid}>
          <For each={activeOrganization()?.teams}>
            {(team) => (
              <article class={styles.teamCard}>
                <span class={styles.teamMonogram} aria-hidden="true">
                  {team.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{team.name}</h3>
                  <p>
                    {events.data()?.filter((event) => event.teamId === team.id).length ?? 0} events
                  </p>
                </div>
                <span class={styles.cardArrow} aria-hidden="true">
                  →
                </span>
              </article>
            )}
          </For>
        </div>
      </section>
    </Page.Root>
  );
}
