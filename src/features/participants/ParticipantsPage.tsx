import styles from "./participants.module.css";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../../components/empty-state";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { StatusBadge } from "../../components/status-badge";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { useWorkspace } from "../workspace/WorkspaceLayout";

const registrationAnswerText = (value: string | boolean | ReadonlyArray<string>) =>
  typeof value === "string"
    ? value
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : value.join(", ");

export default function ParticipantsPage() {
  const { activeOrganization } = useWorkspace();
  const events = useQuery(
    api.events.list,
    () => ({ organizationId: activeOrganization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(activeOrganization()) }),
  );
  const [selectedEventId, setSelectedEventId] = createSignal<Id<"events"> | null>(null);
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
  const [formError, setFormError] = createSignal<string | null>(null);

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
      setFormError(convexErrorMessage(error));
    }
  };

  const handleRegistrationStatus = async (
    registrationId: Id<"registrations">,
    action: "accept" | "withdraw",
  ) => {
    setFormError(null);
    try {
      if (action === "accept") await acceptRegistration.mutate({ registrationId });
      else await withdrawRegistration.mutate({ registrationId });
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };

  return (
    <Page.Root labelledBy="participants-page-title">
      <Page.Header variant="page">
        <Page.Heading>
          <Page.Eyebrow>Attendance operations</Page.Eyebrow>
          <Page.Title id="participants-page-title">Participants</Page.Title>
          <Page.Description>
            Choose an event to manage its registrations and attendance.
          </Page.Description>
        </Page.Heading>
        <Page.Meta>{events.data()?.length ?? 0} events</Page.Meta>
      </Page.Header>
      <div class={styles.participantsLayout}>
        <section class={styles.participantEventPicker} aria-labelledby="participant-events-title">
          <SectionHeader.Root>
            <SectionHeader.Heading>
              <SectionHeader.Eyebrow>Program</SectionHeader.Eyebrow>
              <SectionHeader.Title id="participant-events-title">
                Select an event
              </SectionHeader.Title>
            </SectionHeader.Heading>
          </SectionHeader.Root>
          <div class={styles.participantEventList}>
            <For each={events.data()}>
              {(event) => (
                <button
                  class={styles.participantEventOption}
                  classList={{ [styles.isSelected]: selectedEventId() === event.id }}
                  type="button"
                  aria-pressed={selectedEventId() === event.id}
                  onClick={() => {
                    setFormError(null);
                    setSelectedEventId(event.id);
                  }}
                >
                  <StatusBadge status={event.status} />
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
            <EmptyState.Root class={`empty-page-state ${styles.participantEmptyState}`}>
              <EmptyState.Icon>○</EmptyState.Icon>
              <EmptyState.Content>
                <EmptyState.Title as="h2">Select an event to begin.</EmptyState.Title>
                <EmptyState.Description>Its registrations will appear here.</EmptyState.Description>
              </EmptyState.Content>
            </EmptyState.Root>
          }
        >
          <Show when={eventDetail.data()} fallback={<p>Opening participants…</p>}>
            {(detail) => (
              <section class={`${styles.registrationPanel} ${styles.standaloneRegistrationPanel}`}>
                <div class={styles.registrationHeading}>
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
                    <p class={styles.registrationNote}>
                      Registration opens when this event is published.
                    </p>
                  }
                >
                  <form class={styles.registrationForm} onSubmit={handleRegistrationCreate}>
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
                <Show when={formError()}>
                  <FormError>{formError()}</FormError>
                </Show>
                <div class={styles.registrationList}>
                  <Show
                    when={(registrationList.data()?.length ?? 0) > 0}
                    fallback={<p class={styles.registrationNote}>No participants yet.</p>}
                  >
                    <For each={registrationList.data()}>
                      {(registration) => (
                        <article>
                          <div class={styles.participantAvatar} aria-hidden="true">
                            {registration.participantName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <h4>{registration.participantName}</h4>
                            <p>
                              {registration.participantEmail || registration.externalParticipantId}
                            </p>
                            <Show when={registration.answers.length > 0}>
                              <dl class={styles.registrationAnswers}>
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
                          <span
                            class={styles.registrationStatus}
                            classList={{
                              [styles.isAccepted]: registration.status === "accepted",
                              [styles.isWaitlisted]: registration.status === "waitlisted",
                              [styles.isPending]: registration.status === "pending",
                            }}
                          >
                            {registration.status}
                          </span>
                          <div class={styles.registrationActions}>
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
                  </Show>
                </div>
              </section>
            )}
          </Show>
        </Show>
      </div>
    </Page.Root>
  );
}
