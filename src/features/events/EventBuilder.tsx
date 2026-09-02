import styles from "./events.module.css";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, type JSX } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { TimezoneTypeahead } from "../../components/timezone-typeahead";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { localDateTimeToMillis } from "../../lib/date-time";
import { SignupFieldBuilder, createSignupFields } from "../signup-fields/SignupFieldBuilder";

type Organization = {
  id: Id<"organizations">;
  defaultTimezone: string;
  teams: readonly { id: Id<"teams">; name: string }[];
};

type EventBuilderProps = {
  organization: Organization;
  children: JSX.Element;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (eventId: Id<"events">) => void;
};

type DraftSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  roomName: string;
};

type DraftDate = {
  id: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  sessions: DraftSession[];
  sessionDraft: DraftSession | null;
  editingSessionId: string | null;
};

type EventFormState = {
  error: string | null;
  title: string;
  description: string;
  topicId: Id<"event_topics"> | "";
  teamId: Id<"teams"> | "";
  timezone: string;
};

let draftItemId = 0;
const nextDraftItemId = () => `draft-${++draftItemId}`;
const emptySession = (startsAt = "", endsAt = ""): DraftSession => ({
  id: nextDraftItemId(),
  title: "",
  startsAt,
  endsAt,
  roomName: "",
});
const emptyDate = (): DraftDate => ({
  id: nextDraftItemId(),
  startsAt: "",
  endsAt: "",
  venueName: "",
  sessions: [],
  sessionDraft: null,
  editingSessionId: null,
});
const EventBuilder = (props: EventBuilderProps) => {
  const signupTemplates = useQuery(
    api.events.listSignupTemplates,
    () => ({ organizationId: props.organization?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(props.organization) }),
  );
  const topics = useQuery(
    api.events.listTopics,
    () => ({ organizationId: props.organization.id }),
    () => ({ enabled: Boolean(props.organization) }),
  );
  const createEvent = useMutation(api.events.create);
  const [eventForm, setEventForm] = createStore<EventFormState>({
    error: null,
    title: "",
    description: "",
    topicId: "",
    teamId: "",
    timezone: props.organization.defaultTimezone,
  });
  const [draftDateStore, setDraftDateStore] = createStore<DraftDate[]>([emptyDate()]);
  const signupFields = createSignupFields();
  const draftDates = () => draftDateStore;
  const setDraftDates = (update: DraftDate[] | ((dates: DraftDate[]) => DraftDate[])) => {
    const nextDates = typeof update === "function" ? update([...draftDateStore]) : update;
    setDraftDateStore(reconcile(nextDates, { key: "id" }));
  };
  const updateDraftDate = (dateId: string, update: (date: DraftDate) => DraftDate) => {
    const index = draftDateStore.findIndex((date) => date.id === dateId);
    if (index >= 0) setDraftDateStore(index, update(draftDateStore[index]!));
  };

  const selectedBuilderTeamId = () => eventForm.teamId || props.organization?.teams[0]?.id;
  const availableSignupTemplates = () =>
    signupTemplates
      .data()
      ?.filter(
        (template) =>
          template.scope === "organization" || template.teamId === selectedBuilderTeamId(),
      ) ?? [];

  const resetEventBuilder = () => {
    setEventForm({
      title: "",
      description: "",
      topicId: "",
      teamId: "",
      timezone: props.organization.defaultTimezone,
    });
    setDraftDates([emptyDate()]);
    signupFields.reset();
  };
  const closeEventBuilder = () => {
    resetEventBuilder();
    props.onOpenChange(false);
  };

  const applySignupTemplate = (templateId: string) => {
    const template = signupTemplates.data()?.find((candidate) => candidate.id === templateId);
    if (!template) return;
    signupFields.replace(template.fields);
  };

  const saveDraftSession = (dateId: string) => {
    setEventForm("error", null);
    const date = draftDates().find((candidate) => candidate.id === dateId);
    const session = date?.sessionDraft;
    if (!date || !session) return;
    const startsAt = localDateTimeToMillis(session.startsAt, eventForm.timezone);
    const endsAt = localDateTimeToMillis(session.endsAt, eventForm.timezone);
    const dateStartsAt = localDateTimeToMillis(date.startsAt, eventForm.timezone);
    const dateEndsAt = localDateTimeToMillis(date.endsAt, eventForm.timezone);
    if (session.title.trim().length < 2) {
      setEventForm("error", "Session title must be at least 2 characters.");
      return;
    }
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      setEventForm("error", "The session end time must be after its start time.");
      return;
    }
    if (
      Number.isFinite(dateStartsAt) &&
      Number.isFinite(dateEndsAt) &&
      (startsAt < dateStartsAt || endsAt > dateEndsAt)
    ) {
      setEventForm("error", "A session must fit within its event date.");
      return;
    }
    updateDraftDate(dateId, (current) => ({
      ...current,
      sessions: current.editingSessionId
        ? current.sessions.map((saved) => (saved.id === current.editingSessionId ? session : saved))
        : [...current.sessions, session],
      sessionDraft: null,
      editingSessionId: null,
    }));
  };

  const handleEventCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const organization = props.organization;
    const teamId = eventForm.teamId || organization?.teams[0]?.id;
    const topicId = eventForm.topicId;
    if (!organization || !teamId || !topicId) return;
    setEventForm("error", null);
    try {
      const result = await createEvent.mutate({
        organizationId: organization.id,
        teamId,
        title: eventForm.title,
        description: eventForm.description,
        topicId,
        timezone: eventForm.timezone,
        dates: draftDates().map((date) => ({
          startsAt: localDateTimeToMillis(date.startsAt, eventForm.timezone),
          endsAt: localDateTimeToMillis(date.endsAt, eventForm.timezone),
          venueName: date.venueName,
          sessions: date.sessions.map((session) => ({
            title: session.title,
            startsAt: localDateTimeToMillis(session.startsAt, eventForm.timezone),
            endsAt: localDateTimeToMillis(session.endsAt, eventForm.timezone),
            roomName: session.roomName,
          })),
        })),
        signupFields: signupFields.payload(),
      });
      resetEventBuilder();
      props.onSuccess(result.eventId);
    } catch (error) {
      setEventForm("error", convexErrorMessage(error));
    }
  };

  return (
    <>
      <Page.Header variant="feature">
        <Page.Heading>{props.children}</Page.Heading>
        <button
          class="primary-button"
          type="button"
          disabled={props.organization.teams.length === 0}
          onClick={() => {
            if (props.open) closeEventBuilder();
            else {
              setEventForm("error", null);
              props.onOpenChange(true);
            }
          }}
        >
          {props.open ? "Close" : "New event"} <span aria-hidden="true">＋</span>
        </button>
      </Page.Header>

      <Show when={props.open && props.organization}>
        {(organization) => (
          <form class={styles.eventForm} onSubmit={handleEventCreate}>
            <div class="form-heading">
              <div>
                <p class="eyebrow">New draft</p>
                <h2>Create an event</h2>
                <p>Build the event and its schedule before creating the draft.</p>
              </div>
              <span>{eventForm.timezone}</span>
            </div>
            <div class={styles.builderSectionHeading}>
              <span>01</span>
              <div>
                <h3>Event details</h3>
                <p>Give participants a clear introduction to the event.</p>
              </div>
            </div>
            <div class="form-grid">
              <label class="wide-field">
                <span>Event title</span>
                <input
                  placeholder="Leadership essentials"
                  value={eventForm.title}
                  onInput={(event) => setEventForm("title", event.currentTarget.value)}
                  required
                  autofocus
                />
              </label>
              <label>
                <span>Owning team</span>
                <select
                  value={eventForm.teamId || organization().teams[0]?.id}
                  onChange={(event) =>
                    setEventForm("teamId", event.currentTarget.value as Id<"teams">)
                  }
                  required
                >
                  <For each={organization().teams}>
                    {(team) => <option value={team.id}>{team.name}</option>}
                  </For>
                </select>
              </label>
              <label>
                <span>Topic</span>
                <select
                  value={eventForm.topicId}
                  onChange={(event) =>
                    setEventForm("topicId", event.currentTarget.value as Id<"event_topics">)
                  }
                  required
                >
                  <option value="" disabled>
                    Choose a topic
                  </option>
                  <For each={topics.data()?.topics}>
                    {(topic) => <option value={topic.id}>{topic.name}</option>}
                  </For>
                </select>
              </label>
              <label>
                <span>Event timezone</span>
                <TimezoneTypeahead
                  value={eventForm.timezone}
                  onChange={(timezone) => setEventForm("timezone", timezone)}
                  required
                />
              </label>
              <label class="wide-field">
                <span>Description</span>
                <textarea
                  placeholder="What participants will learn and experience"
                  value={eventForm.description}
                  onInput={(event) => setEventForm("description", event.currentTarget.value)}
                  rows="3"
                />
              </label>
            </div>

            <div class={`${styles.builderSectionHeading} ${styles.scheduleHeading}`}>
              <span>02</span>
              <div>
                <h3>Schedule</h3>
                <p>Add each event date, then place sessions within that date.</p>
              </div>
            </div>
            <div class={styles.builderDateList}>
              <For each={draftDates()}>
                {(date, dateIndex) => (
                  <section class={styles.builderDateCard}>
                    <div class={styles.builderCardHeading}>
                      <strong>Date {dateIndex() + 1}</strong>
                      <Show when={draftDates().length > 1}>
                        <button
                          class="text-button danger-button"
                          type="button"
                          onClick={() =>
                            setDraftDates((dates) =>
                              dates.filter((candidate) => candidate.id !== date.id),
                            )
                          }
                        >
                          Remove date
                        </button>
                      </Show>
                    </div>
                    <div class={styles.builderDateFields}>
                      <label>
                        <span>Starts</span>
                        <input
                          type="datetime-local"
                          value={date.startsAt}
                          onInput={(event) =>
                            updateDraftDate(date.id, (current) => ({
                              ...current,
                              startsAt: event.currentTarget.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>Ends</span>
                        <input
                          type="datetime-local"
                          value={date.endsAt}
                          onInput={(event) =>
                            updateDraftDate(date.id, (current) => ({
                              ...current,
                              endsAt: event.currentTarget.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>Venue</span>
                        <input
                          placeholder="Harbor House"
                          value={date.venueName}
                          onInput={(event) =>
                            updateDraftDate(date.id, (current) => ({
                              ...current,
                              venueName: event.currentTarget.value,
                            }))
                          }
                          required
                        />
                      </label>
                    </div>

                    <div class={styles.builderSessionsHeading}>
                      <div>
                        <strong>Sessions</strong>
                        <span>{date.sessions.length} added</span>
                      </div>
                      <Show when={!date.sessionDraft}>
                        <button
                          class="secondary-button compact-button"
                          type="button"
                          onClick={() =>
                            updateDraftDate(date.id, (current) => ({
                              ...current,
                              sessionDraft: emptySession(current.startsAt, current.endsAt),
                              editingSessionId: null,
                            }))
                          }
                        >
                          ＋ Add session
                        </button>
                      </Show>
                    </div>

                    <Show when={date.sessions.length > 0}>
                      <ul class={styles.builderSessionList}>
                        <For each={date.sessions}>
                          {(session) => (
                            <li>
                              <div>
                                <strong>{session.title}</strong>
                                <span>
                                  {session.startsAt.replace("T", " ")}–
                                  {session.endsAt.split("T")[1]} · {session.roomName || "No room"}
                                </span>
                              </div>
                              <div>
                                <button
                                  class="text-button"
                                  type="button"
                                  onClick={() =>
                                    updateDraftDate(date.id, (current) => ({
                                      ...current,
                                      sessionDraft: { ...session },
                                      editingSessionId: session.id,
                                    }))
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  class="text-button danger-button"
                                  type="button"
                                  onClick={() =>
                                    updateDraftDate(date.id, (current) => ({
                                      ...current,
                                      sessions: current.sessions.filter(
                                        (candidate) => candidate.id !== session.id,
                                      ),
                                    }))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>

                    <Show when={date.sessionDraft}>
                      {(sessionDraft) => (
                        <div class={styles.builderSessionEditor}>
                          <div class={styles.sessionEditorHeading}>
                            <strong>
                              {date.editingSessionId ? "Edit session" : "New session"}
                            </strong>
                          </div>
                          <label class={styles.sessionTitleField}>
                            <span>Session title</span>
                            <input
                              placeholder="Opening keynote"
                              value={sessionDraft().title}
                              onInput={(event) =>
                                updateDraftDate(date.id, (current) => ({
                                  ...current,
                                  sessionDraft: current.sessionDraft
                                    ? {
                                        ...current.sessionDraft,
                                        title: event.currentTarget.value,
                                      }
                                    : null,
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Starts</span>
                            <input
                              type="datetime-local"
                              value={sessionDraft().startsAt}
                              onInput={(event) =>
                                updateDraftDate(date.id, (current) => ({
                                  ...current,
                                  sessionDraft: current.sessionDraft
                                    ? {
                                        ...current.sessionDraft,
                                        startsAt: event.currentTarget.value,
                                      }
                                    : null,
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Ends</span>
                            <input
                              type="datetime-local"
                              value={sessionDraft().endsAt}
                              onInput={(event) =>
                                updateDraftDate(date.id, (current) => ({
                                  ...current,
                                  sessionDraft: current.sessionDraft
                                    ? {
                                        ...current.sessionDraft,
                                        endsAt: event.currentTarget.value,
                                      }
                                    : null,
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>
                              Room <small>Optional</small>
                            </span>
                            <input
                              placeholder="Auditorium"
                              value={sessionDraft().roomName}
                              onInput={(event) =>
                                updateDraftDate(date.id, (current) => ({
                                  ...current,
                                  sessionDraft: current.sessionDraft
                                    ? {
                                        ...current.sessionDraft,
                                        roomName: event.currentTarget.value,
                                      }
                                    : null,
                                }))
                              }
                            />
                          </label>
                          <div class={styles.sessionEditorActions}>
                            <button
                              class="text-button"
                              type="button"
                              onClick={() =>
                                updateDraftDate(date.id, (current) => ({
                                  ...current,
                                  sessionDraft: null,
                                  editingSessionId: null,
                                }))
                              }
                            >
                              Cancel
                            </button>
                            <button
                              class="primary-button compact-button"
                              type="button"
                              onClick={() => saveDraftSession(date.id)}
                            >
                              {date.editingSessionId ? "Save session" : "Add session"}
                            </button>
                          </div>
                        </div>
                      )}
                    </Show>
                  </section>
                )}
              </For>
            </div>
            <button
              class={`secondary-button ${styles.addDateButton}`}
              type="button"
              onClick={() => setDraftDates((dates) => [...dates, emptyDate()])}
            >
              ＋ Add another date
            </button>

            <div class={`${styles.builderSectionHeading} ${styles.signupHeading}`}>
              <span>03</span>
              <div>
                <h3>Sign-up form</h3>
                <p>Ask only what this event needs. Reorder fields or start from a template.</p>
              </div>
            </div>
            <SignupFieldBuilder
              controller={signupFields}
              emptyTitle="No custom questions yet"
              emptyText="Add a field below, or leave the form empty for a simple sign-up."
              paletteAriaLabel="Add a sign-up field"
            >
              <Show when={availableSignupTemplates().length > 0}>
                <label class={styles.templatePicker}>
                  <span>Start from a saved template</span>
                  <select
                    value=""
                    onChange={(event) => {
                      applySignupTemplate(event.currentTarget.value);
                      event.currentTarget.value = "";
                    }}
                  >
                    <option value="">Choose a template…</option>
                    <For each={availableSignupTemplates()}>
                      {(template) => (
                        <option value={template.id}>
                          {template.name} · {template.scope === "team" ? "Team" : "Organization"}
                        </option>
                      )}
                    </For>
                  </select>
                </label>
              </Show>
            </SignupFieldBuilder>
            <Show when={eventForm.error}>
              <FormError>{eventForm.error}</FormError>
            </Show>
            <div class="form-actions">
              <button class="primary-button" type="submit" disabled={createEvent.isLoading()}>
                {createEvent.isLoading() ? "Creating draft…" : "Create draft"}
                <span aria-hidden="true">→</span>
              </button>
              <button class="text-button" type="button" onClick={closeEventBuilder}>
                Cancel
              </button>
              <small>The draft is visible only inside Serenity.</small>
            </div>
          </form>
        )}
      </Show>
    </>
  );
};

export default EventBuilder;
