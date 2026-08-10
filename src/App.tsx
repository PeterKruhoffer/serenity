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
  const activeOrganization = () => workspace.data()?.organizations[0];
  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const pendingRevisions = useQuery(
    api.publication.listPending,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: activeOrganization()?.role === "super_user" }),
  );
  const createOrganization = useMutation(api.workspace.createOrganization);
  const createTeam = useMutation(api.workspace.createTeam);
  const createEvent = useMutation(api.events.create);
  const addEventDate = useMutation(api.events.addDate);
  const addSession = useMutation(api.events.addSession);
  const submitRevision = useMutation(api.publication.submit);
  const approveRevision = useMutation(api.publication.approve);
  const rejectRevision = useMutation(api.publication.reject);
  const startDraft = useMutation(api.publication.startDraft);
  const [organizationName, setOrganizationName] = createSignal("");
  const [firstTeamName, setFirstTeamName] = createSignal("");
  const [newTeamName, setNewTeamName] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
  const [showTeamForm, setShowTeamForm] = createSignal(false);
  const [showEventForm, setShowEventForm] = createSignal(false);
  const [selectedEventId, setSelectedEventId] = createSignal<Id<"events"> | null>(null);
  const [selectedDateId, setSelectedDateId] = createSignal<Id<"event_dates"> | null>(null);
  const [eventTitle, setEventTitle] = createSignal("");
  const [eventDescription, setEventDescription] = createSignal("");
  const [eventTeamId, setEventTeamId] = createSignal<Id<"teams"> | "">("");
  const [eventStartsAt, setEventStartsAt] = createSignal("");
  const [eventEndsAt, setEventEndsAt] = createSignal("");
  const [eventVenue, setEventVenue] = createSignal("");
  const [newDateStartsAt, setNewDateStartsAt] = createSignal("");
  const [newDateEndsAt, setNewDateEndsAt] = createSignal("");
  const [newDateVenue, setNewDateVenue] = createSignal("");
  const [sessionTitle, setSessionTitle] = createSignal("");
  const [sessionStartsAt, setSessionStartsAt] = createSignal("");
  const [sessionEndsAt, setSessionEndsAt] = createSignal("");
  const [sessionRoom, setSessionRoom] = createSignal("");
  const eventDetail = useQuery(
    api.events.get,
    () => ({ eventId: selectedEventId() ?? ("" as Id<"events">) }),
    () => ({ enabled: selectedEventId() !== null }),
  );
  const registrationList = useQuery(
    api.registrations.list,
    () => ({ eventId: selectedEventId() ?? ("" as Id<"events">) }),
    () => ({ enabled: selectedEventId() !== null }),
  );
  const registerParticipant = useMutation(api.registrations.register);
  const acceptRegistration = useMutation(api.registrations.accept);
  const withdrawRegistration = useMutation(api.registrations.withdraw);
  const [participantName, setParticipantName] = createSignal("");
  const [participantEmail, setParticipantEmail] = createSignal("");

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);

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

  const handleEventCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const organization = activeOrganization();
    const teamId = eventTeamId() || organization?.teams[0]?.id;
    if (!organization || !teamId) return;
    setFormError(null);
    try {
      const result = await createEvent.mutate({
        organizationId: organization.id,
        teamId,
        title: eventTitle(),
        description: eventDescription(),
        timezone,
        firstDate: {
          startsAt: new Date(eventStartsAt()).getTime(),
          endsAt: new Date(eventEndsAt()).getTime(),
          venueName: eventVenue(),
        },
      });
      setEventTitle("");
      setEventDescription("");
      setEventStartsAt("");
      setEventEndsAt("");
      setEventVenue("");
      setShowEventForm(false);
      setSelectedEventId(result.eventId);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleDateCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const eventId = selectedEventId();
    if (!eventId) return;
    setFormError(null);
    try {
      await addEventDate.mutate({
        eventId,
        date: {
          startsAt: new Date(newDateStartsAt()).getTime(),
          endsAt: new Date(newDateEndsAt()).getTime(),
          venueName: newDateVenue(),
        },
      });
      setNewDateStartsAt("");
      setNewDateEndsAt("");
      setNewDateVenue("");
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleSessionCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const eventDateId = selectedDateId();
    if (!eventDateId) return;
    setFormError(null);
    try {
      await addSession.mutate({
        eventDateId,
        title: sessionTitle(),
        startsAt: new Date(sessionStartsAt()).getTime(),
        endsAt: new Date(sessionEndsAt()).getTime(),
        roomName: sessionRoom(),
      });
      setSessionTitle("");
      setSessionStartsAt("");
      setSessionEndsAt("");
      setSessionRoom("");
      setSelectedDateId(null);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleSubmitRevision = async (eventId: Id<"events">) => {
    setFormError(null);
    try {
      await submitRevision.mutate({ eventId });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleStartDraft = async (eventId: Id<"events">) => {
    setFormError(null);
    try {
      await startDraft.mutate({ eventId });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleReview = async (
    revisionId: Id<"event_revisions">,
    decision: "approve" | "reject",
  ) => {
    setFormError(null);
    try {
      if (decision === "approve") {
        await approveRevision.mutate({ revisionId, note: "" });
      } else {
        await rejectRevision.mutate({ revisionId, note: "Changes requested by reviewer" });
      }
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleRegistrationCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    const eventId = selectedEventId();
    if (!eventId) return;
    setFormError(null);
    try {
      await registerParticipant.mutate({
        eventId,
        externalParticipantId: participantEmail().trim().toLowerCase(),
        displayName: participantName(),
        email: participantEmail(),
        locale: navigator.language || "en",
        ticketName: "Standard",
        priceMinor: 0,
        paymentStatus: "not_required",
      });
      setParticipantName("");
      setParticipantEmail("");
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleRegistrationStatus = async (
    registrationId: Id<"registrations">,
    action: "accept" | "withdraw",
  ) => {
    setFormError(null);
    try {
      if (action === "accept") {
        await acceptRegistration.mutate({ registrationId });
      } else {
        await withdrawRegistration.mutate({ registrationId });
      }
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
                <button
                  class="primary-button"
                  type="button"
                  disabled={data().organizations[0]?.teams.length === 0}
                  onClick={() => {
                    setFormError(null);
                    setShowEventForm((visible) => !visible);
                  }}
                >
                  {showEventForm() ? "Close" : "New event"} <span aria-hidden="true">＋</span>
                </button>
              </div>

              <Show when={showEventForm() && data().organizations[0]}>
                {(organization) => (
                  <form class="event-form" onSubmit={handleEventCreate}>
                    <div class="form-heading">
                      <div>
                        <p class="eyebrow">New draft</p>
                        <h2>Compose a recurring event</h2>
                      </div>
                      <span>{timezone}</span>
                    </div>
                    <div class="form-grid">
                      <label class="wide-field">
                        <span>Event title</span>
                        <input
                          placeholder="Leadership essentials"
                          value={eventTitle()}
                          onInput={(event) => setEventTitle(event.currentTarget.value)}
                          required
                          autofocus
                        />
                      </label>
                      <label>
                        <span>Owning team</span>
                        <select
                          value={eventTeamId() || organization().teams[0]?.id}
                          onChange={(event) =>
                            setEventTeamId(event.currentTarget.value as Id<"teams">)
                          }
                          required
                        >
                          <For each={organization().teams}>
                            {(team) => <option value={team.id}>{team.name}</option>}
                          </For>
                        </select>
                      </label>
                      <label class="wide-field">
                        <span>Description</span>
                        <textarea
                          placeholder="What participants will learn and experience"
                          value={eventDescription()}
                          onInput={(event) => setEventDescription(event.currentTarget.value)}
                          rows="3"
                        />
                      </label>
                      <label>
                        <span>First date starts</span>
                        <input
                          type="datetime-local"
                          value={eventStartsAt()}
                          onInput={(event) => setEventStartsAt(event.currentTarget.value)}
                          required
                        />
                      </label>
                      <label>
                        <span>First date ends</span>
                        <input
                          type="datetime-local"
                          value={eventEndsAt()}
                          onInput={(event) => setEventEndsAt(event.currentTarget.value)}
                          required
                        />
                      </label>
                      <label>
                        <span>Venue</span>
                        <input
                          placeholder="Harbor House"
                          value={eventVenue()}
                          onInput={(event) => setEventVenue(event.currentTarget.value)}
                          required
                        />
                      </label>
                    </div>
                    <Show when={formError()}>
                      <p class="auth-error" role="alert">
                        {formError()}
                      </p>
                    </Show>
                    <div class="form-actions">
                      <button
                        class="primary-button"
                        type="submit"
                        disabled={createEvent.isLoading()}
                      >
                        {createEvent.isLoading() ? "Creating draft…" : "Create draft"}
                        <span aria-hidden="true">→</span>
                      </button>
                      <small>The draft is visible only inside Serenity.</small>
                    </div>
                  </form>
                )}
              </Show>

              <div class="metric-grid" aria-label="Workspace overview">
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
                    {activeOrganization()?.role === "super_user"
                      ? (pendingRevisions.data()?.length ?? 0)
                      : (events.data()?.filter((event) => event.status === "submitted").length ??
                        0)}
                  </strong>
                  <small>Submitted revisions</small>
                </article>
                <article>
                  <span>Teams</span>
                  <strong>{data().organizations[0]?.teams.length ?? 0}</strong>
                  <small>In this organization</small>
                </article>
              </div>

              <Show when={activeOrganization()?.role === "super_user"}>
                <section class="approvals-section" id="approvals" aria-labelledby="approvals-title">
                  <div class="section-title-row">
                    <div>
                      <p class="eyebrow">Safety boundary</p>
                      <h2 id="approvals-title">Awaiting review</h2>
                    </div>
                    <span class="section-count">
                      {pendingRevisions.data()?.length ?? 0} pending
                    </span>
                  </div>
                  <div class="approval-list">
                    <For each={pendingRevisions.data()}>
                      {(revision) => (
                        <article class="approval-card">
                          <div>
                            <span>Revision {revision.revisionNumber}</span>
                            <h3>{revision.title}</h3>
                            <p>
                              {revision.teamName} · {revision.occurrenceCount} dates ·{" "}
                              {revision.sessionCount} sessions
                            </p>
                          </div>
                          <div class="approval-actions">
                            <button
                              class="secondary-button compact-button"
                              type="button"
                              disabled={rejectRevision.isLoading()}
                              onClick={() => void handleReview(revision.id, "reject")}
                            >
                              Request changes
                            </button>
                            <button
                              class="primary-button compact-button"
                              type="button"
                              disabled={approveRevision.isLoading()}
                              onClick={() => void handleReview(revision.id, "approve")}
                            >
                              Approve & publish
                            </button>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={selectedEventId()}>
                <section class="event-detail" aria-label="Event editor">
                  <Show when={eventDetail.data()} fallback={<p>Opening event…</p>}>
                    {(detail) => (
                      <>
                        <div class="event-detail-heading">
                          <div>
                            <div class="event-meta">
                              <span class={`event-status status-${detail().event.status}`}>
                                {detail().event.status}
                              </span>
                              <span>{detail().event.teamName}</span>
                            </div>
                            <h2>{detail().event.title}</h2>
                            <p>{detail().event.description || "No description yet."}</p>
                          </div>
                          <div class="event-detail-actions">
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
                                class="secondary-button compact-button inverse-button"
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
                                setSelectedEventId(null);
                                setSelectedDateId(null);
                              }}
                            >
                              Close editor
                            </button>
                          </div>
                        </div>

                        <Show when={detail().event.status === "draft"}>
                          <form class="date-form" onSubmit={handleDateCreate}>
                            <div>
                              <strong>Add another date</strong>
                              <span>Build the recurring program one occurrence at a time.</span>
                            </div>
                            <label>
                              <span>Starts</span>
                              <input
                                type="datetime-local"
                                value={newDateStartsAt()}
                                onInput={(event) => setNewDateStartsAt(event.currentTarget.value)}
                                required
                              />
                            </label>
                            <label>
                              <span>Ends</span>
                              <input
                                type="datetime-local"
                                value={newDateEndsAt()}
                                onInput={(event) => setNewDateEndsAt(event.currentTarget.value)}
                                required
                              />
                            </label>
                            <label>
                              <span>Venue</span>
                              <input
                                placeholder="Venue"
                                value={newDateVenue()}
                                onInput={(event) => setNewDateVenue(event.currentTarget.value)}
                                required
                              />
                            </label>
                            <button
                              class="secondary-button compact-button inverse-button"
                              type="submit"
                              disabled={addEventDate.isLoading()}
                            >
                              {addEventDate.isLoading() ? "Adding…" : "Add date"}
                            </button>
                          </form>
                        </Show>

                        <Show when={formError()}>
                          <p class="auth-error" role="alert">
                            {formError()}
                          </p>
                        </Show>

                        <div class="date-list">
                          <For each={detail().dates}>
                            {(date, index) => (
                              <article class="date-card">
                                <div class="date-index" aria-hidden="true">
                                  {String(index() + 1).padStart(2, "0")}
                                </div>
                                <div class="date-content">
                                  <div class="date-heading">
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
                                          setSelectedDateId((current) =>
                                            current === date.id ? null : date.id,
                                          )
                                        }
                                      >
                                        {selectedDateId() === date.id ? "Cancel" : "Add session"}
                                      </button>
                                    </Show>
                                  </div>

                                  <Show when={selectedDateId() === date.id}>
                                    <form class="session-form" onSubmit={handleSessionCreate}>
                                      <input
                                        aria-label="Session title"
                                        placeholder="Session title"
                                        value={sessionTitle()}
                                        onInput={(event) =>
                                          setSessionTitle(event.currentTarget.value)
                                        }
                                        required
                                      />
                                      <input
                                        aria-label="Session starts"
                                        type="datetime-local"
                                        value={sessionStartsAt()}
                                        onInput={(event) =>
                                          setSessionStartsAt(event.currentTarget.value)
                                        }
                                        required
                                      />
                                      <input
                                        aria-label="Session ends"
                                        type="datetime-local"
                                        value={sessionEndsAt()}
                                        onInput={(event) =>
                                          setSessionEndsAt(event.currentTarget.value)
                                        }
                                        required
                                      />
                                      <input
                                        aria-label="Room"
                                        placeholder="Room (optional)"
                                        value={sessionRoom()}
                                        onInput={(event) =>
                                          setSessionRoom(event.currentTarget.value)
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
                                      <p class="empty-sessions">No sessions scheduled yet.</p>
                                    }
                                  >
                                    <ul class="session-list">
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
                                            <small>
                                              {session.roomName || "Room to be decided"}
                                            </small>
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

                        <section class="registration-panel" id="participants">
                          <div class="registration-heading">
                            <div>
                              <span>Participation</span>
                              <h3>Registrations</h3>
                            </div>
                            <strong>{registrationList.data()?.length ?? 0}</strong>
                          </div>
                          <Show when={detail().event.status === "published"}>
                            <form class="registration-form" onSubmit={handleRegistrationCreate}>
                              <input
                                aria-label="Participant name"
                                placeholder="Participant name"
                                value={participantName()}
                                onInput={(event) => setParticipantName(event.currentTarget.value)}
                                required
                              />
                              <input
                                aria-label="Participant email"
                                type="email"
                                placeholder="participant@example.com"
                                value={participantEmail()}
                                onInput={(event) => setParticipantEmail(event.currentTarget.value)}
                                required
                              />
                              <button
                                class="primary-button compact-button"
                                type="submit"
                                disabled={registerParticipant.isLoading()}
                              >
                                {registerParticipant.isLoading() ? "Registering…" : "Register"}
                              </button>
                            </form>
                          </Show>
                          <div class="registration-list">
                            <For each={registrationList.data()}>
                              {(registration) => (
                                <article>
                                  <div class="participant-avatar" aria-hidden="true">
                                    {registration.participantName.slice(0, 1).toUpperCase()}
                                  </div>
                                  <div>
                                    <h4>{registration.participantName}</h4>
                                    <p>
                                      {registration.participantEmail ||
                                        registration.externalParticipantId}
                                    </p>
                                  </div>
                                  <span class={`registration-status is-${registration.status}`}>
                                    {registration.status}
                                  </span>
                                  <div class="registration-actions">
                                    <Show
                                      when={
                                        registration.status === "pending" ||
                                        registration.status === "waitlisted"
                                      }
                                    >
                                      <button
                                        class="text-button"
                                        type="button"
                                        onClick={() =>
                                          void handleRegistrationStatus(registration.id, "accept")
                                        }
                                      >
                                        Accept
                                      </button>
                                    </Show>
                                    <Show when={registration.status !== "withdrawn"}>
                                      <button
                                        class="text-button danger-button"
                                        type="button"
                                        onClick={() =>
                                          void handleRegistrationStatus(registration.id, "withdraw")
                                        }
                                      >
                                        Withdraw
                                      </button>
                                    </Show>
                                  </div>
                                </article>
                              )}
                            </For>
                          </div>
                        </section>
                      </>
                    )}
                  </Show>
                </section>
              </Show>

              <section class="events-section" aria-labelledby="event-list-title">
                <div class="section-title-row">
                  <div>
                    <p class="eyebrow">Program</p>
                    <h2 id="event-list-title">Events</h2>
                  </div>
                  <span class="section-count">{events.data()?.length ?? 0} total</span>
                </div>
                <Show
                  when={(events.data()?.length ?? 0) > 0}
                  fallback={
                    <div class="empty-events">
                      <span aria-hidden="true">◇</span>
                      <div>
                        <h3>Your event list is ready.</h3>
                        <p>Create the first draft to begin composing dates and sessions.</p>
                      </div>
                    </div>
                  }
                >
                  <div class="event-grid">
                    <For each={events.data()}>
                      {(event) => (
                        <button
                          class="event-card"
                          classList={{ "is-selected": selectedEventId() === event.id }}
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setSelectedEventId(event.id);
                            setSelectedDateId(null);
                          }}
                        >
                          <div class="event-card-topline">
                            <span class={`event-status status-${event.status}`}>
                              {event.status}
                            </span>
                            <span>{event.teamName}</span>
                          </div>
                          <h3>{event.title}</h3>
                          <p>{event.description || "No description yet."}</p>
                          <div class="event-card-stats">
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
                          <p>
                            {events.data()?.filter((event) => event.teamId === team.id).length ?? 0}{" "}
                            events
                          </p>
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
                Continue to AuthKit to choose Google, GitHub, or email and open your Serenity
                workspace.
              </p>
              <div class="auth-actions">
                <button class="primary-button" type="button" onClick={() => void auth.signIn()}>
                  Continue to sign in
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <Show when={auth.error()}>
                <p class="auth-error" role="alert">
                  {auth.error()}
                </p>
              </Show>
              <p class="auth-note">
                Provider selection and verification are securely handled by WorkOS AuthKit.
              </p>
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
