import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Match, Show, Switch, createSignal, type Component } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { A } from "@solidjs/router";
import { useWorkOSAuth } from "./auth";
import { accountNameFor, greetingNameFor } from "./display-name";

type OrganizationRole = "administrator" | "super_user" | "event_manager";

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

type SignupFieldType = "text" | "textarea" | "yes_no" | "checkboxes";

type DraftSignupField = {
  id: string;
  type: SignupFieldType;
  label: string;
  required: boolean;
  options: string[];
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
const emptySignupField = (type: SignupFieldType): DraftSignupField => ({
  id: nextDraftItemId(),
  type,
  label: "",
  required: false,
  options: type === "checkboxes" ? [""] : [],
});

const roleLabel = (role: OrganizationRole) =>
  ({
    administrator: "Administrator",
    super_user: "Super user",
    event_manager: "Event manager",
  })[role];

const canReviewRevisions = (role: OrganizationRole | undefined) =>
  role === "administrator" || role === "super_user";

const errorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
};

const convexSiteUrl = () =>
  import.meta.env.VITE_CONVEX_SITE_URL ||
  import.meta.env.VITE_CONVEX_URL.replace(".convex.cloud", ".convex.site");
const signupEmbedUrl = (eventId: Id<"events">) =>
  `${window.location.origin}/embed/events/${eventId}/signup`;
const signupApiUrl = (eventId: Id<"events">) =>
  `${convexSiteUrl()}/api/v1/events/${eventId}/signup-form`;
const registrationAnswerText = (value: string | boolean | ReadonlyArray<string>) =>
  typeof value === "string"
    ? value
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : value.join(", ");

export type WorkspacePage = "events" | "templates" | "approvals" | "participants" | "settings";

const Workspace: Component<{ page: WorkspacePage }> = (props) => {
  const auth = useWorkOSAuth();
  const currentPage = () => props.page;
  const workspace = useQuery(api.workspace.list, {});
  const activeOrganization = () => workspace.data()?.organizations[0];
  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const signupTemplates = useQuery(
    api.events.listSignupTemplates,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const pendingRevisions = useQuery(
    api.publication.listPending,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: canReviewRevisions(activeOrganization()?.role) }),
  );
  const createOrganization = useMutation(api.workspace.createOrganization);
  const createTeam = useMutation(api.workspace.createTeam);
  const createEvent = useMutation(api.events.create);
  const saveSignupTemplate = useMutation(api.events.saveSignupTemplate);
  const updateSignupTemplate = useMutation(api.events.updateSignupTemplate);
  const deleteSignupTemplate = useMutation(api.events.deleteSignupTemplate);
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
  const [draftDateStore, setDraftDateStore] = createStore<DraftDate[]>([emptyDate()]);
  const [signupFieldStore, setSignupFieldStore] = createStore<DraftSignupField[]>([]);
  const [templateFieldStore, setTemplateFieldStore] = createStore<DraftSignupField[]>([]);
  const [templateName, setTemplateName] = createSignal("");
  const [templateScope, setTemplateScope] = createSignal<"organization" | "team">("organization");
  const [templateTeamId, setTemplateTeamId] = createSignal<Id<"teams"> | "">("");
  const [editingTemplateId, setEditingTemplateId] =
    createSignal<Id<"signup_form_templates"> | null>(null);
  const [showTemplateForm, setShowTemplateForm] = createSignal(false);
  const draftDates = () => draftDateStore;
  const setDraftDates = (update: DraftDate[] | ((dates: DraftDate[]) => DraftDate[])) => {
    const nextDates = typeof update === "function" ? update([...draftDateStore]) : update;
    setDraftDateStore(reconcile(nextDates, { key: "id" }));
  };
  const setSignupFields = (
    update: DraftSignupField[] | ((fields: DraftSignupField[]) => DraftSignupField[]),
  ) => {
    const nextFields = typeof update === "function" ? update([...signupFieldStore]) : update;
    setSignupFieldStore(reconcile(nextFields, { key: "id" }));
  };
  const setTemplateFields = (
    update: DraftSignupField[] | ((fields: DraftSignupField[]) => DraftSignupField[]),
  ) => {
    const nextFields = typeof update === "function" ? update([...templateFieldStore]) : update;
    setTemplateFieldStore(reconcile(nextFields, { key: "id" }));
  };
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

  const updateDraftDate = (dateId: string, update: (date: DraftDate) => DraftDate) => {
    const index = draftDateStore.findIndex((date) => date.id === dateId);
    if (index >= 0) setDraftDateStore(index, update(draftDateStore[index]!));
  };

  const updateSignupField = (
    fieldId: string,
    update: (field: DraftSignupField) => DraftSignupField,
  ) => {
    const index = signupFieldStore.findIndex((field) => field.id === fieldId);
    if (index >= 0) setSignupFieldStore(index, update(signupFieldStore[index]!));
  };

  const updateTemplateField = (
    fieldId: string,
    update: (field: DraftSignupField) => DraftSignupField,
  ) => {
    const index = templateFieldStore.findIndex((field) => field.id === fieldId);
    if (index >= 0) setTemplateFieldStore(index, update(templateFieldStore[index]!));
  };

  const signupFieldsPayload = () =>
    signupFieldStore.map(({ type, label, required, options }) => ({
      type,
      label,
      required,
      options,
    }));
  const templateFieldsPayload = () =>
    templateFieldStore.map(({ type, label, required, options }) => ({
      type,
      label,
      required,
      options,
    }));
  const selectedBuilderTeamId = () => eventTeamId() || activeOrganization()?.teams[0]?.id;
  const availableSignupTemplates = () =>
    signupTemplates
      .data()
      ?.filter(
        (template) =>
          template.scope === "organization" || template.teamId === selectedBuilderTeamId(),
      ) ?? [];

  const resetEventBuilder = () => {
    setEventTitle("");
    setEventDescription("");
    setEventTeamId("");
    setDraftDates([emptyDate()]);
    setSignupFields([]);
  };

  const resetTemplateBuilder = () => {
    const organization = activeOrganization();
    setTemplateName("");
    setTemplateScope(organization?.role === "event_manager" ? "team" : "organization");
    setTemplateTeamId(organization?.teams[0]?.id ?? "");
    setTemplateFields([]);
    setEditingTemplateId(null);
    setShowTemplateForm(false);
  };

  const applySignupTemplate = (templateId: string) => {
    const template = signupTemplates.data()?.find((candidate) => candidate.id === templateId);
    if (!template) return;
    setSignupFields(
      template.fields.map((field) => ({
        id: nextDraftItemId(),
        type: field.type,
        label: field.label,
        required: field.required,
        options: [...field.options],
      })),
    );
  };

  const handleSignupTemplateSave = async (event: SubmitEvent) => {
    event.preventDefault();
    const organization = activeOrganization();
    if (!organization || templateFieldStore.length === 0) return;
    setFormError(null);
    try {
      const teamId = templateTeamId() || organization.teams[0]?.id;
      const templateId = editingTemplateId();
      const template = {
        ...(templateScope() === "team" && teamId ? { teamId } : {}),
        name: templateName(),
        scope: templateScope(),
        fields: templateFieldsPayload(),
      };
      if (templateId) {
        await updateSignupTemplate.mutate({ templateId, ...template });
      } else {
        await saveSignupTemplate.mutate({ organizationId: organization.id, ...template });
      }
      resetTemplateBuilder();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const editSignupTemplate = (templateId: Id<"signup_form_templates">) => {
    const template = signupTemplates.data()?.find((candidate) => candidate.id === templateId);
    if (!template) return;
    setFormError(null);
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateScope(template.scope);
    setTemplateTeamId(template.teamId ?? activeOrganization()?.teams[0]?.id ?? "");
    setTemplateFields(
      template.fields.map((field) => ({
        id: nextDraftItemId(),
        type: field.type,
        label: field.label,
        required: field.required,
        options: [...field.options],
      })),
    );
    setShowTemplateForm(true);
  };

  const handleSignupTemplateDelete = async (
    templateId: Id<"signup_form_templates">,
    name: string,
  ) => {
    if (!window.confirm(`Delete “${name}”? Events already created from it will not be changed.`))
      return;
    setFormError(null);
    try {
      await deleteSignupTemplate.mutate({ templateId });
      if (editingTemplateId() === templateId) resetTemplateBuilder();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const saveDraftSession = (dateId: string) => {
    setFormError(null);
    const date = draftDates().find((candidate) => candidate.id === dateId);
    const session = date?.sessionDraft;
    if (!date || !session) return;
    const startsAt = new Date(session.startsAt).getTime();
    const endsAt = new Date(session.endsAt).getTime();
    const dateStartsAt = new Date(date.startsAt).getTime();
    const dateEndsAt = new Date(date.endsAt).getTime();
    if (session.title.trim().length < 2) {
      setFormError("Session title must be at least 2 characters.");
      return;
    }
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
      setFormError("The session end time must be after its start time.");
      return;
    }
    if (
      Number.isFinite(dateStartsAt) &&
      Number.isFinite(dateEndsAt) &&
      (startsAt < dateStartsAt || endsAt > dateEndsAt)
    ) {
      setFormError("A session must fit within its event date.");
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
        dates: draftDates().map((date) => ({
          startsAt: new Date(date.startsAt).getTime(),
          endsAt: new Date(date.endsAt).getTime(),
          venueName: date.venueName,
          sessions: date.sessions.map((session) => ({
            title: session.title,
            startsAt: new Date(session.startsAt).getTime(),
            endsAt: new Date(session.endsAt).getTime(),
            roomName: session.roomName,
          })),
        })),
        signupFields: signupFieldsPayload(),
      });
      resetEventBuilder();
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
                <A
                  class="nav-item"
                  classList={{ "is-active": currentPage() === "events" }}
                  href="/events"
                  aria-current={currentPage() === "events" ? "page" : undefined}
                >
                  <span aria-hidden="true">◫</span> Events
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": currentPage() === "templates" }}
                  href="/templates"
                  aria-current={currentPage() === "templates" ? "page" : undefined}
                >
                  <span aria-hidden="true">▤</span> Templates
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": currentPage() === "approvals" }}
                  href="/approvals"
                  aria-current={currentPage() === "approvals" ? "page" : undefined}
                >
                  <span aria-hidden="true">✓</span> Approvals
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": currentPage() === "participants" }}
                  href="/participants"
                  aria-current={currentPage() === "participants" ? "page" : undefined}
                >
                  <span aria-hidden="true">○</span> Participants
                </A>
                <A
                  class="nav-item"
                  classList={{ "is-active": currentPage() === "settings" }}
                  href="/settings"
                  aria-current={currentPage() === "settings" ? "page" : undefined}
                >
                  <span aria-hidden="true">⌘</span> Settings
                </A>
              </nav>
            </aside>

            <section class="workspace-content">
              <Show when={currentPage() === "events"}>
                <section class="workspace-page" aria-labelledby="events-title">
                  <div class="content-heading">
                    <div>
                      <p class="eyebrow">Event operations</p>
                      <h1 id="events-title">
                        Good afternoon, {greetingNameFor(auth.user(), data().viewer.displayName)}.
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
                            <h2>Create an event</h2>
                            <p>Build the event and its schedule before creating the draft.</p>
                          </div>
                          <span>{timezone}</span>
                        </div>
                        <div class="builder-section-heading">
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
                        </div>

                        <div class="builder-section-heading schedule-heading">
                          <span>02</span>
                          <div>
                            <h3>Schedule</h3>
                            <p>Add each event date, then place sessions within that date.</p>
                          </div>
                        </div>
                        <div class="builder-date-list">
                          <For each={draftDates()}>
                            {(date, dateIndex) => (
                              <section class="builder-date-card">
                                <div class="builder-card-heading">
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
                                <div class="builder-date-fields">
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

                                <div class="builder-sessions-heading">
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
                                          sessionDraft: emptySession(
                                            current.startsAt,
                                            current.endsAt,
                                          ),
                                          editingSessionId: null,
                                        }))
                                      }
                                    >
                                      ＋ Add session
                                    </button>
                                  </Show>
                                </div>

                                <Show when={date.sessions.length > 0}>
                                  <ul class="builder-session-list">
                                    <For each={date.sessions}>
                                      {(session) => (
                                        <li>
                                          <div>
                                            <strong>{session.title}</strong>
                                            <span>
                                              {session.startsAt.replace("T", " ")}–
                                              {session.endsAt.split("T")[1]} ·{" "}
                                              {session.roomName || "No room"}
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
                                    <div class="builder-session-editor">
                                      <div class="session-editor-heading">
                                        <strong>
                                          {date.editingSessionId ? "Edit session" : "New session"}
                                        </strong>
                                      </div>
                                      <label class="session-title-field">
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
                                      <div class="session-editor-actions">
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
                          class="secondary-button add-date-button"
                          type="button"
                          onClick={() => setDraftDates((dates) => [...dates, emptyDate()])}
                        >
                          ＋ Add another date
                        </button>

                        <div class="builder-section-heading signup-heading">
                          <span>03</span>
                          <div>
                            <h3>Sign-up form</h3>
                            <p>
                              Ask only what this event needs. Reorder fields or start from a
                              template.
                            </p>
                          </div>
                        </div>
                        <div class="signup-builder">
                          <Show when={availableSignupTemplates().length > 0}>
                            <label class="template-picker">
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
                                      {template.name} ·{" "}
                                      {template.scope === "team" ? "Team" : "Organization"}
                                    </option>
                                  )}
                                </For>
                              </select>
                            </label>
                          </Show>

                          <Show
                            when={signupFieldStore.length > 0}
                            fallback={
                              <div class="signup-empty-state">
                                <strong>No custom questions yet</strong>
                                <span>
                                  Add a field below, or leave the form empty for a simple sign-up.
                                </span>
                              </div>
                            }
                          >
                            <div class="signup-field-list">
                              <For each={signupFieldStore}>
                                {(field, fieldIndex) => (
                                  <section class="signup-field-card">
                                    <div class="signup-field-heading">
                                      <span>{fieldIndex() + 1}</span>
                                      <strong>
                                        {
                                          {
                                            text: "Short answer",
                                            textarea: "Long answer",
                                            yes_no: "Yes or no",
                                            checkboxes: "Checkboxes",
                                          }[field.type]
                                        }
                                      </strong>
                                      <div class="signup-field-actions">
                                        <button
                                          class="text-button"
                                          type="button"
                                          aria-label={`Move ${field.label || "field"} up`}
                                          disabled={fieldIndex() === 0}
                                          onClick={() =>
                                            setSignupFields((fields) => {
                                              const index = fields.findIndex(
                                                (candidate) => candidate.id === field.id,
                                              );
                                              if (index <= 0) return fields;
                                              const reordered = [...fields];
                                              [reordered[index - 1], reordered[index]] = [
                                                reordered[index]!,
                                                reordered[index - 1]!,
                                              ];
                                              return reordered;
                                            })
                                          }
                                        >
                                          ↑
                                        </button>
                                        <button
                                          class="text-button"
                                          type="button"
                                          aria-label={`Move ${field.label || "field"} down`}
                                          disabled={fieldIndex() === signupFieldStore.length - 1}
                                          onClick={() =>
                                            setSignupFields((fields) => {
                                              const index = fields.findIndex(
                                                (candidate) => candidate.id === field.id,
                                              );
                                              if (index < 0 || index === fields.length - 1)
                                                return fields;
                                              const reordered = [...fields];
                                              [reordered[index], reordered[index + 1]] = [
                                                reordered[index + 1]!,
                                                reordered[index]!,
                                              ];
                                              return reordered;
                                            })
                                          }
                                        >
                                          ↓
                                        </button>
                                        <button
                                          class="text-button danger-button"
                                          type="button"
                                          onClick={() =>
                                            setSignupFields((fields) =>
                                              fields.filter(
                                                (candidate) => candidate.id !== field.id,
                                              ),
                                            )
                                          }
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <div class="signup-field-editor">
                                      <label class="signup-question-field">
                                        <span>Question</span>
                                        <input
                                          placeholder="What would you like us to know?"
                                          value={field.label}
                                          onInput={(event) =>
                                            updateSignupField(field.id, (current) => ({
                                              ...current,
                                              label: event.currentTarget.value,
                                            }))
                                          }
                                          required
                                        />
                                      </label>
                                      <label>
                                        <span>Answer type</span>
                                        <select
                                          value={field.type}
                                          onChange={(event) =>
                                            updateSignupField(field.id, (current) => {
                                              const type = event.currentTarget
                                                .value as SignupFieldType;
                                              return {
                                                ...current,
                                                type,
                                                options:
                                                  type === "checkboxes"
                                                    ? current.options.length > 0
                                                      ? current.options
                                                      : [""]
                                                    : [],
                                              };
                                            })
                                          }
                                        >
                                          <option value="text">Short answer</option>
                                          <option value="textarea">Long answer</option>
                                          <option value="yes_no">Yes or no</option>
                                          <option value="checkboxes">Checkboxes</option>
                                        </select>
                                      </label>
                                      <label class="required-toggle">
                                        <input
                                          type="checkbox"
                                          checked={field.required}
                                          onChange={(event) =>
                                            updateSignupField(field.id, (current) => ({
                                              ...current,
                                              required: event.currentTarget.checked,
                                            }))
                                          }
                                        />
                                        <span>Required</span>
                                      </label>
                                    </div>
                                    <Show when={field.type === "checkboxes"}>
                                      <div class="signup-options">
                                        <span>Choices</span>
                                        <For each={field.options}>
                                          {(option, optionIndex) => (
                                            <div>
                                              <input
                                                aria-label={`Choice ${optionIndex() + 1}`}
                                                placeholder={`Choice ${optionIndex() + 1}`}
                                                value={option}
                                                onInput={(event) =>
                                                  updateSignupField(field.id, (current) => ({
                                                    ...current,
                                                    options: current.options.map(
                                                      (currentOption, index) =>
                                                        index === optionIndex()
                                                          ? event.currentTarget.value
                                                          : currentOption,
                                                    ),
                                                  }))
                                                }
                                                required
                                              />
                                              <Show when={field.options.length > 1}>
                                                <button
                                                  class="text-button danger-button"
                                                  type="button"
                                                  aria-label={`Remove choice ${optionIndex() + 1}`}
                                                  onClick={() =>
                                                    updateSignupField(field.id, (current) => ({
                                                      ...current,
                                                      options: current.options.filter(
                                                        (_, index) => index !== optionIndex(),
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  Remove
                                                </button>
                                              </Show>
                                            </div>
                                          )}
                                        </For>
                                        <button
                                          class="text-button"
                                          type="button"
                                          onClick={() =>
                                            updateSignupField(field.id, (current) => ({
                                              ...current,
                                              options: [...current.options, ""],
                                            }))
                                          }
                                        >
                                          ＋ Add choice
                                        </button>
                                      </div>
                                    </Show>
                                  </section>
                                )}
                              </For>
                            </div>
                          </Show>

                          <div class="signup-field-palette" aria-label="Add a sign-up field">
                            <span>Add field</span>
                            <For
                              each={
                                [
                                  ["text", "＋ Short answer"],
                                  ["textarea", "＋ Long answer"],
                                  ["yes_no", "＋ Yes or no"],
                                  ["checkboxes", "＋ Checkboxes"],
                                ] as const
                              }
                            >
                              {([type, label]) => (
                                <button
                                  class="secondary-button compact-button"
                                  type="button"
                                  onClick={() =>
                                    setSignupFields((fields) => [...fields, emptySignupField(type)])
                                  }
                                >
                                  {label}
                                </button>
                              )}
                            </For>
                          </div>
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
                          <button
                            class="text-button"
                            type="button"
                            onClick={() => {
                              resetEventBuilder();
                              setShowEventForm(false);
                            }}
                          >
                            Cancel
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
                        {canReviewRevisions(activeOrganization()?.role)
                          ? (pendingRevisions.data()?.length ?? 0)
                          : (events.data()?.filter((event) => event.status === "submitted")
                              .length ?? 0)}
                      </strong>
                      <small>Submitted revisions</small>
                    </article>
                    <article>
                      <span>Teams</span>
                      <strong>{data().organizations[0]?.teams.length ?? 0}</strong>
                      <small>In this organization</small>
                    </article>
                  </div>
                </section>
              </Show>

              <Show when={currentPage() === "approvals"}>
                <section class="workspace-page" aria-labelledby="approvals-page-title">
                  <div class="content-heading page-heading">
                    <div>
                      <p class="eyebrow">Publication review</p>
                      <h1 id="approvals-page-title">Approvals</h1>
                      <p>Review submitted revisions before they are published.</p>
                    </div>
                    <span class="page-total">{pendingRevisions.data()?.length ?? 0} pending</span>
                  </div>

                  <Show
                    when={canReviewRevisions(activeOrganization()?.role)}
                    fallback={
                      <div class="empty-page-state">
                        <span aria-hidden="true">✓</span>
                        <div>
                          <h2>Approvals are handled by administrators and super users.</h2>
                          <p>You can still track submitted events from the Events page.</p>
                        </div>
                      </div>
                    }
                  >
                    <section class="approvals-section" aria-labelledby="approvals-title">
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
                        <Show
                          when={(pendingRevisions.data()?.length ?? 0) > 0}
                          fallback={
                            <div class="empty-page-state compact-empty-state">
                              <span aria-hidden="true">✓</span>
                              <div>
                                <h2>Everything is reviewed.</h2>
                                <p>New submissions will appear here when they are ready.</p>
                              </div>
                            </div>
                          }
                        >
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
                        </Show>
                      </div>
                    </section>
                  </Show>
                </section>
              </Show>

              <Show when={currentPage() === "events" && selectedEventId()}>
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

                        <Show when={detail().event.status === "published"}>
                          <section
                            class="signup-integration"
                            aria-labelledby="signup-integration-title"
                          >
                            <div>
                              <span>Public sign-up</span>
                              <h3 id="signup-integration-title">
                                Embed or build your own experience
                              </h3>
                              <p>
                                The published form version is available through either interface.
                              </p>
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
                              class="secondary-button compact-button inverse-button"
                              href={signupEmbedUrl(detail().event.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open sign-up form ↗
                            </a>
                          </section>
                        </Show>

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
                      </>
                    )}
                  </Show>
                </section>
              </Show>

              <Show when={currentPage() === "events"}>
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
              </Show>

              <Show when={currentPage() === "participants"}>
                <section class="workspace-page" aria-labelledby="participants-page-title">
                  <div class="content-heading page-heading">
                    <div>
                      <p class="eyebrow">Attendance operations</p>
                      <h1 id="participants-page-title">Participants</h1>
                      <p>Choose an event to manage its registrations and attendance.</p>
                    </div>
                    <span class="page-total">{events.data()?.length ?? 0} events</span>
                  </div>

                  <div class="participants-layout">
                    <section
                      class="participant-event-picker"
                      aria-labelledby="participant-events-title"
                    >
                      <div class="section-title-row">
                        <div>
                          <p class="eyebrow">Program</p>
                          <h2 id="participant-events-title">Select an event</h2>
                        </div>
                      </div>
                      <div class="participant-event-list">
                        <For each={events.data()}>
                          {(event) => (
                            <button
                              class="participant-event-option"
                              classList={{ "is-selected": selectedEventId() === event.id }}
                              type="button"
                              aria-pressed={selectedEventId() === event.id}
                              onClick={() => {
                                setFormError(null);
                                setSelectedEventId(event.id);
                              }}
                            >
                              <span class={`event-status status-${event.status}`}>
                                {event.status}
                              </span>
                              <span>
                                <strong>{event.title}</strong>
                                <small>{event.teamName}</small>
                              </span>
                              <span aria-hidden="true">→</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </section>

                    <Show
                      when={selectedEventId()}
                      fallback={
                        <div class="empty-page-state participant-empty-state">
                          <span aria-hidden="true">○</span>
                          <div>
                            <h2>Select an event to begin.</h2>
                            <p>Its registrations will appear here.</p>
                          </div>
                        </div>
                      }
                    >
                      <Show when={eventDetail.data()} fallback={<p>Opening participants…</p>}>
                        {(detail) => (
                          <section class="registration-panel standalone-registration-panel">
                            <div class="registration-heading">
                              <div>
                                <span>{detail().event.teamName}</span>
                                <h3>{detail().event.title}</h3>
                                <p>Registrations</p>
                              </div>
                              <strong>{registrationList.data()?.length ?? 0}</strong>
                            </div>

                            <Show
                              when={detail().event.status === "published"}
                              fallback={
                                <p class="registration-note">
                                  Registration opens when this event is published.
                                </p>
                              }
                            >
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
                                  onInput={(event) =>
                                    setParticipantEmail(event.currentTarget.value)
                                  }
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

                            <Show when={formError()}>
                              <p class="auth-error" role="alert">
                                {formError()}
                              </p>
                            </Show>

                            <div class="registration-list">
                              <Show
                                when={(registrationList.data()?.length ?? 0) > 0}
                                fallback={<p class="registration-note">No participants yet.</p>}
                              >
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
                                        <Show when={registration.answers.length > 0}>
                                          <dl class="registration-answers">
                                            <For each={registration.answers}>
                                              {(answer) => (
                                                <div>
                                                  <dt>{answer.label}</dt>
                                                  <dd>{registrationAnswerText(answer.value)}</dd>
                                                </div>
                                              )}
                                            </For>
                                          </dl>
                                        </Show>
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
                                              void handleRegistrationStatus(
                                                registration.id,
                                                "accept",
                                              )
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
                                              void handleRegistrationStatus(
                                                registration.id,
                                                "withdraw",
                                              )
                                            }
                                          >
                                            Withdraw
                                          </button>
                                        </Show>
                                      </div>
                                    </article>
                                  )}
                                </For>
                              </Show>
                            </div>
                          </section>
                        )}
                      </Show>
                    </Show>
                  </div>
                </section>
              </Show>

              <Show when={currentPage() === "templates"}>
                <section class="workspace-page" aria-labelledby="templates-page-title">
                  <div class="content-heading page-heading">
                    <div>
                      <p class="eyebrow">Reusable sign-up forms</p>
                      <h1 id="templates-page-title">Templates</h1>
                      <p>
                        Create forms once, then use them for events across your organization or
                        within a specific team.
                      </p>
                    </div>
                    <button
                      class="primary-button"
                      type="button"
                      disabled={data().organizations[0]?.teams.length === 0}
                      onClick={() => {
                        if (showTemplateForm()) {
                          resetTemplateBuilder();
                        } else {
                          const organization = data().organizations[0];
                          setFormError(null);
                          setEditingTemplateId(null);
                          setTemplateName("");
                          setTemplateScope(
                            organization?.role === "event_manager" ? "team" : "organization",
                          );
                          setTemplateTeamId(organization?.teams[0]?.id ?? "");
                          setTemplateFields([]);
                          setShowTemplateForm(true);
                        }
                      }}
                    >
                      {showTemplateForm() ? "Close" : "New template"}{" "}
                      <span aria-hidden="true">＋</span>
                    </button>
                  </div>

                  <Show when={showTemplateForm() && data().organizations[0]}>
                    {(organization) => (
                      <form class="template-editor-form" onSubmit={handleSignupTemplateSave}>
                        <div class="form-heading">
                          <div>
                            <p class="eyebrow">
                              {editingTemplateId() ? "Edit template" : "New template"}
                            </p>
                            <h2>{editingTemplateId() ? templateName() : "Build a sign-up form"}</h2>
                            <p>Changes affect future uses only, not events already created.</p>
                          </div>
                        </div>

                        <div class="form-grid template-details-grid">
                          <label class="wide-field">
                            <span>Template name</span>
                            <input
                              placeholder="Standard attendee questions"
                              value={templateName()}
                              onInput={(event) => setTemplateName(event.currentTarget.value)}
                              required
                              autofocus
                            />
                          </label>
                          <label>
                            <span>Available to</span>
                            <select
                              value={templateScope()}
                              onChange={(event) =>
                                setTemplateScope(
                                  event.currentTarget.value as "organization" | "team",
                                )
                              }
                            >
                              <Show when={organization().role !== "event_manager"}>
                                <option value="organization">Entire organization</option>
                              </Show>
                              <option value="team">Specific team</option>
                            </select>
                          </label>
                          <Show when={templateScope() === "team"}>
                            <label>
                              <span>Team</span>
                              <select
                                value={templateTeamId() || organization().teams[0]?.id}
                                onChange={(event) =>
                                  setTemplateTeamId(event.currentTarget.value as Id<"teams">)
                                }
                                required
                              >
                                <For each={organization().teams}>
                                  {(team) => <option value={team.id}>{team.name}</option>}
                                </For>
                              </select>
                            </label>
                          </Show>
                        </div>

                        <div class="signup-builder template-field-builder">
                          <Show
                            when={templateFieldStore.length > 0}
                            fallback={
                              <div class="signup-empty-state">
                                <strong>No questions yet</strong>
                                <span>Add the first field to start building this template.</span>
                              </div>
                            }
                          >
                            <div class="signup-field-list">
                              <For each={templateFieldStore}>
                                {(field, fieldIndex) => (
                                  <section class="signup-field-card">
                                    <div class="signup-field-heading">
                                      <span>{fieldIndex() + 1}</span>
                                      <strong>
                                        {
                                          {
                                            text: "Short answer",
                                            textarea: "Long answer",
                                            yes_no: "Yes or no",
                                            checkboxes: "Checkboxes",
                                          }[field.type]
                                        }
                                      </strong>
                                      <div class="signup-field-actions">
                                        <button
                                          class="text-button"
                                          type="button"
                                          aria-label={`Move ${field.label || "field"} up`}
                                          disabled={fieldIndex() === 0}
                                          onClick={() =>
                                            setTemplateFields((fields) => {
                                              const index = fields.findIndex(
                                                (candidate) => candidate.id === field.id,
                                              );
                                              if (index <= 0) return fields;
                                              const reordered = [...fields];
                                              [reordered[index - 1], reordered[index]] = [
                                                reordered[index]!,
                                                reordered[index - 1]!,
                                              ];
                                              return reordered;
                                            })
                                          }
                                        >
                                          ↑
                                        </button>
                                        <button
                                          class="text-button"
                                          type="button"
                                          aria-label={`Move ${field.label || "field"} down`}
                                          disabled={fieldIndex() === templateFieldStore.length - 1}
                                          onClick={() =>
                                            setTemplateFields((fields) => {
                                              const index = fields.findIndex(
                                                (candidate) => candidate.id === field.id,
                                              );
                                              if (index < 0 || index === fields.length - 1)
                                                return fields;
                                              const reordered = [...fields];
                                              [reordered[index], reordered[index + 1]] = [
                                                reordered[index + 1]!,
                                                reordered[index]!,
                                              ];
                                              return reordered;
                                            })
                                          }
                                        >
                                          ↓
                                        </button>
                                        <button
                                          class="text-button danger-button"
                                          type="button"
                                          onClick={() =>
                                            setTemplateFields((fields) =>
                                              fields.filter(
                                                (candidate) => candidate.id !== field.id,
                                              ),
                                            )
                                          }
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <div class="signup-field-editor">
                                      <label class="signup-question-field">
                                        <span>Question</span>
                                        <input
                                          placeholder="What would you like us to know?"
                                          value={field.label}
                                          onInput={(event) =>
                                            updateTemplateField(field.id, (current) => ({
                                              ...current,
                                              label: event.currentTarget.value,
                                            }))
                                          }
                                          required
                                        />
                                      </label>
                                      <label>
                                        <span>Answer type</span>
                                        <select
                                          value={field.type}
                                          onChange={(event) =>
                                            updateTemplateField(field.id, (current) => {
                                              const type = event.currentTarget
                                                .value as SignupFieldType;
                                              return {
                                                ...current,
                                                type,
                                                options:
                                                  type === "checkboxes"
                                                    ? current.options.length > 0
                                                      ? current.options
                                                      : [""]
                                                    : [],
                                              };
                                            })
                                          }
                                        >
                                          <option value="text">Short answer</option>
                                          <option value="textarea">Long answer</option>
                                          <option value="yes_no">Yes or no</option>
                                          <option value="checkboxes">Checkboxes</option>
                                        </select>
                                      </label>
                                      <label class="required-toggle">
                                        <input
                                          type="checkbox"
                                          checked={field.required}
                                          onChange={(event) =>
                                            updateTemplateField(field.id, (current) => ({
                                              ...current,
                                              required: event.currentTarget.checked,
                                            }))
                                          }
                                        />
                                        <span>Required</span>
                                      </label>
                                    </div>
                                    <Show when={field.type === "checkboxes"}>
                                      <div class="signup-options">
                                        <span>Choices</span>
                                        <For each={field.options}>
                                          {(option, optionIndex) => (
                                            <div>
                                              <input
                                                aria-label={`Choice ${optionIndex() + 1}`}
                                                placeholder={`Choice ${optionIndex() + 1}`}
                                                value={option}
                                                onInput={(event) =>
                                                  updateTemplateField(field.id, (current) => ({
                                                    ...current,
                                                    options: current.options.map(
                                                      (currentOption, index) =>
                                                        index === optionIndex()
                                                          ? event.currentTarget.value
                                                          : currentOption,
                                                    ),
                                                  }))
                                                }
                                                required
                                              />
                                              <Show when={field.options.length > 1}>
                                                <button
                                                  class="text-button danger-button"
                                                  type="button"
                                                  aria-label={`Remove choice ${optionIndex() + 1}`}
                                                  onClick={() =>
                                                    updateTemplateField(field.id, (current) => ({
                                                      ...current,
                                                      options: current.options.filter(
                                                        (_, index) => index !== optionIndex(),
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  Remove
                                                </button>
                                              </Show>
                                            </div>
                                          )}
                                        </For>
                                        <button
                                          class="text-button"
                                          type="button"
                                          onClick={() =>
                                            updateTemplateField(field.id, (current) => ({
                                              ...current,
                                              options: [...current.options, ""],
                                            }))
                                          }
                                        >
                                          ＋ Add choice
                                        </button>
                                      </div>
                                    </Show>
                                  </section>
                                )}
                              </For>
                            </div>
                          </Show>

                          <div class="signup-field-palette" aria-label="Add a template field">
                            <span>Add field</span>
                            <For
                              each={
                                [
                                  ["text", "＋ Short answer"],
                                  ["textarea", "＋ Long answer"],
                                  ["yes_no", "＋ Yes or no"],
                                  ["checkboxes", "＋ Checkboxes"],
                                ] as const
                              }
                            >
                              {([type, label]) => (
                                <button
                                  class="secondary-button compact-button"
                                  type="button"
                                  onClick={() =>
                                    setTemplateFields((fields) => [
                                      ...fields,
                                      emptySignupField(type),
                                    ])
                                  }
                                >
                                  {label}
                                </button>
                              )}
                            </For>
                          </div>
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
                            disabled={
                              !templateName().trim() ||
                              templateFieldStore.length === 0 ||
                              saveSignupTemplate.isLoading() ||
                              updateSignupTemplate.isLoading()
                            }
                          >
                            {saveSignupTemplate.isLoading() || updateSignupTemplate.isLoading()
                              ? "Saving…"
                              : editingTemplateId()
                                ? "Save changes"
                                : "Create template"}
                          </button>
                          <button class="text-button" type="button" onClick={resetTemplateBuilder}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </Show>

                  <section class="templates-section" aria-labelledby="saved-templates-title">
                    <div class="section-title-row">
                      <div>
                        <p class="eyebrow">Form library</p>
                        <h2 id="saved-templates-title">Saved templates</h2>
                      </div>
                      <span class="section-count">
                        {signupTemplates.data()?.length ?? 0} templates
                      </span>
                    </div>
                    <Show when={formError() && !showTemplateForm()}>
                      <p class="auth-error" role="alert">
                        {formError()}
                      </p>
                    </Show>
                    <Show
                      when={(signupTemplates.data()?.length ?? 0) > 0}
                      fallback={
                        <div class="template-library-empty">
                          <strong>No templates yet</strong>
                          <p>Create a reusable form to make event setup faster and consistent.</p>
                        </div>
                      }
                    >
                      <div class="template-grid">
                        <For each={signupTemplates.data()}>
                          {(template) => {
                            const canManage = () =>
                              data().organizations[0]?.role !== "event_manager" ||
                              template.scope === "team";
                            const teamName = () =>
                              data().organizations[0]?.teams.find(
                                (team) => team.id === template.teamId,
                              )?.name;
                            return (
                              <article class="template-card">
                                <div class="template-card-heading">
                                  <span
                                    classList={{
                                      "organization-scope": template.scope === "organization",
                                    }}
                                  >
                                    {template.scope === "organization"
                                      ? "Organization"
                                      : teamName() || "Team"}
                                  </span>
                                  <div class="template-card-actions">
                                    <Show when={canManage()}>
                                      <button
                                        class="text-button"
                                        type="button"
                                        onClick={() => editSignupTemplate(template.id)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        class="text-button danger-button"
                                        type="button"
                                        disabled={deleteSignupTemplate.isLoading()}
                                        onClick={() =>
                                          void handleSignupTemplateDelete(
                                            template.id,
                                            template.name,
                                          )
                                        }
                                      >
                                        Delete
                                      </button>
                                    </Show>
                                  </div>
                                </div>
                                <h3>{template.name}</h3>
                                <p>
                                  {template.fields.length} question
                                  {template.fields.length === 1 ? "" : "s"}
                                </p>
                                <ol class="template-question-preview">
                                  <For each={template.fields.slice(0, 3)}>
                                    {(field) => <li>{field.label}</li>}
                                  </For>
                                </ol>
                                <Show when={template.fields.length > 3}>
                                  <small>+{template.fields.length - 3} more</small>
                                </Show>
                              </article>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </section>
                </section>
              </Show>

              <Show when={currentPage() === "settings"}>
                <section class="workspace-page" aria-labelledby="settings-page-title">
                  <div class="content-heading page-heading">
                    <div>
                      <p class="eyebrow">Workspace administration</p>
                      <h1 id="settings-page-title">Settings</h1>
                      <p>Manage the teams that own and deliver your organization’s events.</p>
                    </div>
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
                              <p>
                                {events.data()?.filter((event) => event.teamId === team.id)
                                  .length ?? 0}{" "}
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
              </Show>
            </section>
          </div>
        )}
      </Match>
    </Switch>
  );
};

const App: Component<{ page?: WorkspacePage }> = (props) => {
  const auth = useWorkOSAuth();
  const signedInName = () => accountNameFor(auth.user());

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
          <div class="account-summary" aria-label={`Signed in as ${signedInName()}`}>
            <span class="header-avatar" aria-hidden="true">
              {signedInName().slice(0, 1).toUpperCase()}
            </span>
            <span class="account-copy">
              <strong>{signedInName()}</strong>
              <small>{auth.user()?.email || "WorkOS authenticated"}</small>
            </span>
            <button class="text-button" type="button" onClick={auth.signOut}>
              Sign out
            </button>
          </div>
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

          <Match when={auth.isWorkspaceAuthenticated()}>
            <Workspace page={props.page ?? "events"} />
          </Match>

          <Match when={auth.isAuthenticated()}>
            <section class="welcome" aria-labelledby="welcome-title">
              <p class="eyebrow">Authentication complete</p>
              <h1 id="welcome-title">You’re signed in.</h1>
              <p class="intro">
                WorkOS recognized {auth.user()?.email}. Serenity is still waiting for the secure
                workspace connection.
              </p>
              <div class="auth-actions">
                <button
                  class="primary-button"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Retry connection
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <Show when={auth.error()}>
                <p class="auth-error" role="alert">
                  {auth.error()}
                </p>
              </Show>
            </section>
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
