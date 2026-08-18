import styles from "./settings.module.css";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
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
  const [newTeamName, setNewTeamName] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
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
