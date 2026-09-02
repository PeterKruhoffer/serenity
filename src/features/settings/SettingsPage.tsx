import styles from "./settings.module.css";
import { useSearchParams } from "@solidjs/router";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { TimezoneTypeahead } from "../../components/timezone-typeahead";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { applyTheme, readTheme, type Theme } from "../../theme";
import { useWorkspace } from "../workspace/WorkspaceContext";

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeOrganization } = useWorkspace();
  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const topics = useQuery(
    api.events.listTopics,
    () => ({ organizationId: activeOrganization().id }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const createTeam = useMutation(api.workspace.createTeam);
  const updateDefaultTimezone = useMutation(api.workspace.updateDefaultTimezone);
  const createTopic = useMutation(api.events.createTopic);
  const updateTopic = useMutation(api.events.updateTopic);
  const archiveTopic = useMutation(api.events.archiveTopic);
  const [newTeamName, setNewTeamName] = createSignal("");
  const [newTopicName, setNewTopicName] = createSignal("");
  const [editingTopicId, setEditingTopicId] = createSignal<Id<"event_topics"> | null>(null);
  const [editingTopicName, setEditingTopicName] = createSignal("");
  const [defaultTimezone, setDefaultTimezone] = createSignal(activeOrganization().defaultTimezone);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [timezoneError, setTimezoneError] = createSignal<string | null>(null);
  const [topicError, setTopicError] = createSignal<string | null>(null);
  const [theme, setTheme] = createSignal<Theme>(readTheme());
  const showTeamForm = () =>
    searchParams.action === "new-team" && activeOrganization().role === "administrator";

  const handleTeamCreate = async (event: SubmitEvent, organizationId: Id<"organizations">) => {
    event.preventDefault();
    setFormError(null);
    try {
      await createTeam.mutate({ organizationId, name: newTeamName() });
      setNewTeamName("");
      setSearchParams({ action: undefined });
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

  const handleTopicCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    setTopicError(null);
    try {
      await createTopic.mutate({
        organizationId: activeOrganization().id,
        name: newTopicName(),
      });
      setNewTopicName("");
    } catch (error) {
      setTopicError(convexErrorMessage(error));
    }
  };

  const handleTopicUpdate = async (event: SubmitEvent) => {
    event.preventDefault();
    const topicId = editingTopicId();
    if (!topicId) return;
    setTopicError(null);
    try {
      await updateTopic.mutate({ topicId, name: editingTopicName() });
      setEditingTopicId(null);
      setEditingTopicName("");
    } catch (error) {
      setTopicError(convexErrorMessage(error));
    }
  };

  const handleTopicArchive = async (topicId: Id<"event_topics">) => {
    setTopicError(null);
    try {
      await archiveTopic.mutate({ topicId });
      if (editingTopicId() === topicId) setEditingTopicId(null);
    } catch (error) {
      setTopicError(convexErrorMessage(error));
    }
  };

  const selectTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
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
      <section class={styles.appearanceSection} aria-labelledby="appearance-settings-title">
        <SectionHeader.Root>
          <SectionHeader.Heading>
            <SectionHeader.Eyebrow>Personal preference</SectionHeader.Eyebrow>
            <SectionHeader.Title id="appearance-settings-title">Appearance</SectionHeader.Title>
          </SectionHeader.Heading>
        </SectionHeader.Root>
        <p class={styles.settingDescription}>
          Choose how Serenity looks on this browser. Your selection is saved on this device.
        </p>
        <div class={styles.themeOptions} aria-label="Color theme">
          <button
            class={styles.themeOption}
            type="button"
            aria-pressed={theme() === "ritual"}
            onClick={() => selectTheme("ritual")}
          >
            <span class={`${styles.themePreview} ${styles.ritualPreview}`} aria-hidden="true">
              <i />
              <i />
            </span>
            <span>
              <strong>Ritual</strong>
              <small>Warm light</small>
            </span>
          </button>
          <button
            class={styles.themeOption}
            type="button"
            aria-pressed={theme() === "nocturne"}
            onClick={() => selectTheme("nocturne")}
          >
            <span class={`${styles.themePreview} ${styles.nocturnePreview}`} aria-hidden="true">
              <i />
              <i />
            </span>
            <span>
              <strong>Nocturne</strong>
              <small>Deep dark</small>
            </span>
          </button>
        </div>
      </section>
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
      <section class={styles.topicsSection} aria-labelledby="event-topics-title">
        <SectionHeader.Root>
          <SectionHeader.Heading>
            <SectionHeader.Eyebrow>Event classification</SectionHeader.Eyebrow>
            <SectionHeader.Title id="event-topics-title">Topics</SectionHeader.Title>
          </SectionHeader.Heading>
        </SectionHeader.Root>
        <p class={styles.settingDescription}>
          Event creators choose from this list. Renaming updates a topic everywhere; removing it
          hides it from future event pickers.
        </p>
        <Show when={activeOrganization().role === "administrator"}>
          <form class={styles.inlineForm} onSubmit={handleTopicCreate}>
            <label>
              <span class={styles.srOnly}>New topic name</span>
              <input
                placeholder="New topic"
                value={newTopicName()}
                onInput={(event) => setNewTopicName(event.currentTarget.value)}
                required
              />
            </label>
            <button
              class="primary-button compact-button"
              type="submit"
              disabled={createTopic.isLoading()}
            >
              {createTopic.isLoading() ? "Adding…" : "Add topic"}
            </button>
          </form>
        </Show>
        <Show when={topicError()}>
          <FormError>{topicError()}</FormError>
        </Show>
        <ul class={styles.topicList}>
          <For
            each={topics.data()?.topics}
            fallback={<li>No topics have been added to this organization.</li>}
          >
            {(topic) => (
              <li>
                <Show
                  when={editingTopicId() === topic.id}
                  fallback={
                    <>
                      <span>{topic.name}</span>
                      <Show when={activeOrganization().role === "administrator"}>
                        <div>
                          <button
                            class="text-button"
                            type="button"
                            onClick={() => {
                              setEditingTopicId(topic.id);
                              setEditingTopicName(topic.name);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            class="text-button danger-button"
                            type="button"
                            disabled={archiveTopic.isLoading()}
                            onClick={() => void handleTopicArchive(topic.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </Show>
                    </>
                  }
                >
                  <form class={styles.topicEditForm} onSubmit={handleTopicUpdate}>
                    <input
                      aria-label="Topic name"
                      value={editingTopicName()}
                      onInput={(event) => setEditingTopicName(event.currentTarget.value)}
                      required
                      autofocus
                    />
                    <button
                      class="primary-button compact-button"
                      type="submit"
                      disabled={updateTopic.isLoading()}
                    >
                      {updateTopic.isLoading() ? "Saving…" : "Save"}
                    </button>
                    <button
                      class="text-button"
                      type="button"
                      onClick={() => setEditingTopicId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                </Show>
              </li>
            )}
          </For>
        </ul>
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
              onClick={() => setSearchParams({ action: showTeamForm() ? undefined : "new-team" })}
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
