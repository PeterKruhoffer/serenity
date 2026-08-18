import styles from "./events.module.css";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useWorkspace } from "../workspace/WorkspaceLayout";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useWorkOSAuth } from "../../auth";
import { greetingNameFor } from "../../display-name";
import { EmptyState } from "../../components/empty-state";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { StatusBadge } from "../../components/status-badge";
import { convexErrorMessage } from "../../lib/convex-error-message";
import EventBuilder from "./EventBuilder";

type OrganizationRole = "administrator" | "super_user" | "event_manager";

type EventEditorState = {
  error: string | null;
  selectedEventId: Id<"events"> | null;
  selectedDateId: Id<"event_dates"> | null;
  newDate: { startsAt: string; endsAt: string; venueName: string };
  session: { title: string; startsAt: string; endsAt: string; roomName: string };
};

const canReviewRevisions = (role: OrganizationRole | undefined) =>
  role === "administrator" || role === "super_user";

const convexSiteUrl = () =>
  import.meta.env.VITE_CONVEX_SITE_URL ||
  import.meta.env.VITE_CONVEX_URL.replace(".convex.cloud", ".convex.site");
const signupEmbedUrl = (eventId: Id<"events">) =>
  `${window.location.origin}/embed/events/${eventId}/signup`;
const signupApiUrl = (eventId: Id<"events">) =>
  `${convexSiteUrl()}/api/v1/events/${eventId}/signup-form`;
const EventsPage = () => {
  const auth = useWorkOSAuth();
  const { workspace, activeOrganization } = useWorkspace();
  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const pendingRevisions = useQuery(
    api.publication.listPending,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: canReviewRevisions(activeOrganization()?.role) }),
  );
  const addEventDate = useMutation(api.events.addDate);
  const addSession = useMutation(api.events.addSession);
  const submitRevision = useMutation(api.publication.submit);
  const startDraft = useMutation(api.publication.startDraft);
  const [editor, setEditor] = createStore<EventEditorState>({
    error: null,
    selectedEventId: null,
    selectedDateId: null,
    newDate: { startsAt: "", endsAt: "", venueName: "" },
    session: { title: "", startsAt: "", endsAt: "", roomName: "" },
  });
  const eventDetail = useQuery(
    api.events.get,
    () => ({ eventId: editor.selectedEventId ?? ("" as Id<"events">) }),
    () => ({ enabled: editor.selectedEventId !== null }),
  );

  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);

  const handleDateCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const eventId = editor.selectedEventId;
    if (!eventId) return;
    setEditor("error", null);
    try {
      await addEventDate.mutate({
        eventId,
        date: {
          startsAt: new Date(editor.newDate.startsAt).getTime(),
          endsAt: new Date(editor.newDate.endsAt).getTime(),
          venueName: editor.newDate.venueName,
        },
      });
      setEditor("newDate", { startsAt: "", endsAt: "", venueName: "" });
    } catch (error) {
      setEditor("error", convexErrorMessage(error));
    }
  };

  const handleSessionCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const eventDateId = editor.selectedDateId;
    if (!eventDateId) return;
    setEditor("error", null);
    try {
      await addSession.mutate({
        eventDateId,
        title: editor.session.title,
        startsAt: new Date(editor.session.startsAt).getTime(),
        endsAt: new Date(editor.session.endsAt).getTime(),
        roomName: editor.session.roomName,
      });
      setEditor("session", { title: "", startsAt: "", endsAt: "", roomName: "" });
      setEditor("selectedDateId", null);
    } catch (error) {
      setEditor("error", convexErrorMessage(error));
    }
  };

  const handleSubmitRevision = async (eventId: Id<"events">) => {
    setEditor("error", null);
    try {
      await submitRevision.mutate({ eventId });
    } catch (error) {
      setEditor("error", convexErrorMessage(error));
    }
  };

  const handleStartDraft = async (eventId: Id<"events">) => {
    setEditor("error", null);
    try {
      await startDraft.mutate({ eventId });
    } catch (error) {
      setEditor("error", convexErrorMessage(error));
    }
  };

  return (
    <>
      <Page.Root labelledBy="events-title">
        <EventBuilder
          organization={activeOrganization()!}
          onSuccess={(eventId) => setEditor("selectedEventId", eventId)}
        >
          <Page.Eyebrow>Event operations</Page.Eyebrow>
          <Page.Title id="events-title">
            Good afternoon, {greetingNameFor(auth.user(), workspace().viewer.displayName)}.
          </Page.Title>
          <Page.Description>
            Everything your teams are preparing, reviewing, and publishing.
          </Page.Description>
        </EventBuilder>

        <div class={styles.metricGrid} aria-label="Workspace overview">
          <article>
            <span>Active events</span>
            <strong>{events.data()?.length ?? 0}</strong>
            <small>
              {events.data()?.length ? "Across your teams" : "Ready for your first event"}
            </small>
          </article>
          <article>
            <span>Awaiting review</span>
            <strong>
              {canReviewRevisions(activeOrganization()?.role)
                ? (pendingRevisions.data()?.length ?? 0)
                : (events.data()?.filter((event) => event.status === "submitted").length ?? 0)}
            </strong>
            <small>Submitted revisions</small>
          </article>
          <article>
            <span>Teams</span>
            <strong>{activeOrganization()?.teams.length ?? 0}</strong>
            <small>In this organization</small>
          </article>
        </div>
      </Page.Root>

      <Show when={editor.selectedEventId}>
        <section class={styles.eventDetail} aria-label="Event editor">
          <Show when={eventDetail.data()} fallback={<p>Opening event…</p>}>
            {(detail) => (
              <>
                <div class={styles.eventDetailHeading}>
                  <div>
                    <div class={styles.eventMeta}>
                      <StatusBadge status={detail().event.status} />
                      <span>{detail().event.teamName}</span>
                    </div>
                    <h2>{detail().event.title}</h2>
                    <p>{detail().event.description || "No description yet."}</p>
                  </div>
                  <div class={styles.eventDetailActions}>
                    <Show when={detail().event.status === "draft"}>
                      <button
                        class="primary-button compact-button"
                        type="button"
                        disabled={submitRevision.isLoading()}
                        onClick={() => void handleSubmitRevision(detail().event.id)}
                      >
                        {submitRevision.isLoading() ? "Submitting…" : "Submit for review"}
                      </button>
                    </Show>
                    <Show when={detail().event.status === "published"}>
                      <button
                        class={`secondary-button compact-button ${styles.inverseButton}`}
                        type="button"
                        disabled={startDraft.isLoading()}
                        onClick={() => void handleStartDraft(detail().event.id)}
                      >
                        {startDraft.isLoading() ? "Starting…" : "Start new draft"}
                      </button>
                    </Show>
                    <button
                      class="text-button"
                      type="button"
                      onClick={() => {
                        setEditor({ selectedEventId: null, selectedDateId: null });
                      }}
                    >
                      Close editor
                    </button>
                  </div>
                </div>

                <Show when={detail().event.status === "published"}>
                  <section
                    class={styles.signupIntegration}
                    aria-labelledby="signup-integration-title"
                  >
                    <div>
                      <span>Public sign-up</span>
                      <h3 id="signup-integration-title">Embed or build your own experience</h3>
                      <p>The published form version is available through either interface.</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Iframe</dt>
                        <dd>
                          <code>{signupEmbedUrl(detail().event.id)}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>JSON API</dt>
                        <dd>
                          <code>{signupApiUrl(detail().event.id)}</code>
                        </dd>
                      </div>
                    </dl>
                    <a
                      class={`secondary-button compact-button ${styles.inverseButton}`}
                      href={signupEmbedUrl(detail().event.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open sign-up form ↗
                    </a>
                  </section>
                </Show>

                <Show when={detail().event.status === "draft"}>
                  <form class={styles.dateForm} onSubmit={handleDateCreate}>
                    <div>
                      <strong>Add another date</strong>
                      <span>Build the recurring program one occurrence at a time.</span>
                    </div>
                    <label>
                      <span>Starts</span>
                      <input
                        type="datetime-local"
                        value={editor.newDate.startsAt}
                        onInput={(event) =>
                          setEditor("newDate", "startsAt", event.currentTarget.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Ends</span>
                      <input
                        type="datetime-local"
                        value={editor.newDate.endsAt}
                        onInput={(event) =>
                          setEditor("newDate", "endsAt", event.currentTarget.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Venue</span>
                      <input
                        placeholder="Venue"
                        value={editor.newDate.venueName}
                        onInput={(event) =>
                          setEditor("newDate", "venueName", event.currentTarget.value)
                        }
                        required
                      />
                    </label>
                    <button
                      class={`secondary-button compact-button ${styles.inverseButton}`}
                      type="submit"
                      disabled={addEventDate.isLoading()}
                    >
                      {addEventDate.isLoading() ? "Adding…" : "Add date"}
                    </button>
                  </form>
                </Show>

                <Show when={editor.error}>
                  <FormError>{editor.error}</FormError>
                </Show>

                <div class={styles.dateList}>
                  <For each={detail().dates}>
                    {(date, index) => (
                      <article class={styles.dateCard}>
                        <div class={styles.dateIndex} aria-hidden="true">
                          {String(index() + 1).padStart(2, "0")}
                        </div>
                        <div class={styles.dateContent}>
                          <div class={styles.dateHeading}>
                            <div>
                              <h3>{formatDate(date.startsAt)}</h3>
                              <p>
                                {date.venueName} · ends {formatDate(date.endsAt)}
                              </p>
                            </div>
                            <Show when={detail().event.status === "draft"}>
                              <button
                                class="text-button"
                                type="button"
                                onClick={() =>
                                  setEditor("selectedDateId", (current) =>
                                    current === date.id ? null : date.id,
                                  )
                                }
                              >
                                {editor.selectedDateId === date.id ? "Cancel" : "Add session"}
                              </button>
                            </Show>
                          </div>

                          <Show when={editor.selectedDateId === date.id}>
                            <form class={styles.sessionForm} onSubmit={handleSessionCreate}>
                              <input
                                aria-label="Session title"
                                placeholder="Session title"
                                value={editor.session.title}
                                onInput={(event) =>
                                  setEditor("session", "title", event.currentTarget.value)
                                }
                                required
                              />
                              <input
                                aria-label="Session starts"
                                type="datetime-local"
                                value={editor.session.startsAt}
                                onInput={(event) =>
                                  setEditor("session", "startsAt", event.currentTarget.value)
                                }
                                required
                              />
                              <input
                                aria-label="Session ends"
                                type="datetime-local"
                                value={editor.session.endsAt}
                                onInput={(event) =>
                                  setEditor("session", "endsAt", event.currentTarget.value)
                                }
                                required
                              />
                              <input
                                aria-label="Room"
                                placeholder="Room (optional)"
                                value={editor.session.roomName}
                                onInput={(event) =>
                                  setEditor("session", "roomName", event.currentTarget.value)
                                }
                              />
                              <button
                                class="primary-button compact-button"
                                type="submit"
                                disabled={addSession.isLoading()}
                              >
                                {addSession.isLoading() ? "Adding…" : "Add"}
                              </button>
                            </form>
                          </Show>

                          <Show
                            when={date.sessions.length > 0}
                            fallback={
                              <p class={styles.emptySessions}>No sessions scheduled yet.</p>
                            }
                          >
                            <ul class={styles.sessionList}>
                              <For each={date.sessions}>
                                {(session) => (
                                  <li>
                                    <span>
                                      {new Intl.DateTimeFormat(undefined, {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }).format(session.startsAt)}
                                    </span>
                                    <strong>{session.title}</strong>
                                    <small>{session.roomName || "Room to be decided"}</small>
                                  </li>
                                )}
                              </For>
                            </ul>
                          </Show>
                        </div>
                      </article>
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>
        </section>
      </Show>

      <section class={styles.eventsSection} aria-labelledby="event-list-title">
        <SectionHeader.Root>
          <SectionHeader.Heading>
            <SectionHeader.Eyebrow>Program</SectionHeader.Eyebrow>
            <SectionHeader.Title id="event-list-title">Events</SectionHeader.Title>
          </SectionHeader.Heading>
          <SectionHeader.Count>{events.data()?.length ?? 0} total</SectionHeader.Count>
        </SectionHeader.Root>
        <Show
          when={(events.data()?.length ?? 0) > 0}
          fallback={
            <EmptyState.Root class={styles.emptyEvents}>
              <EmptyState.Icon>◇</EmptyState.Icon>
              <EmptyState.Content>
                <EmptyState.Title as="h3">Your event list is ready.</EmptyState.Title>
                <EmptyState.Description>
                  Create the first draft to begin composing dates and sessions.
                </EmptyState.Description>
              </EmptyState.Content>
            </EmptyState.Root>
          }
        >
          <div class={styles.eventGrid}>
            <For each={events.data()}>
              {(event) => (
                <button
                  class={styles.eventCard}
                  classList={{ [styles.isSelected]: editor.selectedEventId === event.id }}
                  type="button"
                  onClick={() => {
                    setEditor({ error: null, selectedEventId: event.id, selectedDateId: null });
                  }}
                >
                  <div class={styles.eventCardTopline}>
                    <StatusBadge status={event.status} />
                    <span>{event.teamName}</span>
                  </div>
                  <h3>{event.title}</h3>
                  <p>{event.description || "No description yet."}</p>
                  <div class={styles.eventCardStats}>
                    <span>{event.occurrenceCount} dates</span>
                    <span>{event.sessionCount} sessions</span>
                    <span aria-hidden="true">→</span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>
    </>
  );
};

export default EventsPage;
