import { useAction, useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormError } from "../../components/form-error";
import { SectionHeader } from "../../components/section-header";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { useWorkspace } from "../workspace/WorkspaceContext";
import styles from "./webhooks-settings.module.css";

const EVENT_TYPES = [
  "event.published",
  "registration.created",
  "registration.accepted",
  "registration.withdrawn",
  "registration.date_declined",
  "registration.date_decline_reversed",
] as const;

const eventLabel = (eventType: string) => eventType.replaceAll(".", " · ").replaceAll("_", " ");

export default function WebhooksSettings() {
  const { activeOrganization } = useWorkspace();
  const isAdministrator = () => activeOrganization().role === "administrator";
  const endpoints = useQuery(
    api.webhooks.listEndpoints,
    () => ({ organizationId: activeOrganization().id }),
    () => ({ enabled: isAdministrator() }),
  );
  const deliveries = useQuery(
    api.webhooks.listDeliveries,
    () => ({ organizationId: activeOrganization().id }),
    () => ({ enabled: isAdministrator() }),
  );
  const createEndpoint = useAction(api.webhooks.createEndpoint);
  const rotateSecret = useAction(api.webhooks.rotateSecret);
  const updateEndpoint = useMutation(api.webhooks.updateEndpoint);
  const deleteEndpoint = useMutation(api.webhooks.deleteEndpoint);
  const sendTest = useMutation(api.webhooks.sendTest);
  const retryDelivery = useMutation(api.webhooks.retryDelivery);
  const [showForm, setShowForm] = createSignal(false);
  const [url, setUrl] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [subscriptions, setSubscriptions] = createSignal<Array<(typeof EVENT_TYPES)[number]>>([
    ...EVENT_TYPES,
  ]);
  const [revealedSecret, setRevealedSecret] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const toggleSubscription = (eventType: (typeof EVENT_TYPES)[number], selected: boolean) => {
    setSubscriptions((current) =>
      selected ? [...current, eventType] : current.filter((candidate) => candidate !== eventType),
    );
  };

  const create = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const result = await createEndpoint.mutate({
        organizationId: activeOrganization().id,
        url: url(),
        description: description(),
        subscribedEventTypes: subscriptions(),
      });
      setRevealedSecret(result.signingSecret);
      setNotice(
        "Endpoint saved disabled. Send a test, then enable it when your receiver is ready.",
      );
      setUrl("");
      setDescription("");
      setShowForm(false);
    } catch (cause) {
      setError(convexErrorMessage(cause));
    }
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(success);
    } catch (cause) {
      setError(convexErrorMessage(cause));
    }
  };

  const rotate = async (endpointId: Id<"webhook_endpoints">) => {
    setError(null);
    try {
      const result = await rotateSecret.mutate({ endpointId });
      setRevealedSecret(result.signingSecret);
      setNotice("Signing secret rotated. The previous secret remains valid for 24 hours.");
    } catch (cause) {
      setError(convexErrorMessage(cause));
    }
  };

  return (
    <section class={styles.section} aria-labelledby="webhook-settings-title">
      <SectionHeader.Root>
        <SectionHeader.Heading>
          <SectionHeader.Eyebrow>Developer integrations</SectionHeader.Eyebrow>
          <SectionHeader.Title id="webhook-settings-title">Webhooks</SectionHeader.Title>
        </SectionHeader.Heading>
        <Show when={isAdministrator()}>
          <button
            class="secondary-button compact-button"
            type="button"
            onClick={() => setShowForm((visible) => !visible)}
          >
            {showForm() ? "Cancel" : "Add endpoint"}
          </button>
        </Show>
      </SectionHeader.Root>
      <p class={styles.description}>
        Send signed event and registration updates to customer systems. Deliveries are retried and
        may arrive more than once, so receivers should deduplicate by event ID.
      </p>

      <Show
        when={isAdministrator()}
        fallback={<p class={styles.empty}>Only organization administrators can manage webhooks.</p>}
      >
        <Show when={showForm()}>
          <form class={styles.form} onSubmit={create}>
            <label>
              <span>Endpoint URL</span>
              <input
                type="url"
                inputmode="url"
                placeholder="https://example.com/api/serenity-webhooks"
                value={url()}
                onInput={(event) => setUrl(event.currentTarget.value)}
                required
                autofocus
              />
            </label>
            <label>
              <span>Description</span>
              <input
                maxlength="160"
                placeholder="Production event sync"
                value={description()}
                onInput={(event) => setDescription(event.currentTarget.value)}
              />
            </label>
            <fieldset>
              <legend>Events</legend>
              <div class={styles.eventOptions}>
                <For each={EVENT_TYPES}>
                  {(eventType) => (
                    <label>
                      <input
                        type="checkbox"
                        checked={subscriptions().includes(eventType)}
                        onChange={(event) =>
                          toggleSubscription(eventType, event.currentTarget.checked)
                        }
                      />
                      <span>{eventLabel(eventType)}</span>
                    </label>
                  )}
                </For>
              </div>
            </fieldset>
            <button
              class="primary-button compact-button"
              type="submit"
              disabled={createEndpoint.isLoading() || subscriptions().length === 0}
            >
              {createEndpoint.isLoading() ? "Creating…" : "Create disabled endpoint"}
            </button>
          </form>
        </Show>

        <Show when={revealedSecret()}>
          {(secret) => (
            <aside class={styles.secret} aria-live="polite">
              <div>
                <strong>Copy this signing secret now</strong>
                <p>Serenity will not show it again.</p>
              </div>
              <code>{secret()}</code>
              <button
                class="secondary-button compact-button"
                type="button"
                onClick={() => navigator.clipboard.writeText(secret())}
              >
                Copy secret
              </button>
              <button class={styles.dismiss} type="button" onClick={() => setRevealedSecret(null)}>
                I saved it
              </button>
            </aside>
          )}
        </Show>
        <Show when={notice()}>
          <p class={styles.notice} role="status">
            {notice()}
          </p>
        </Show>
        <Show when={error()}>
          <FormError>{error()}</FormError>
        </Show>

        <div class={styles.endpointList}>
          <For
            each={endpoints.data()}
            fallback={<p class={styles.empty}>No webhook endpoints yet.</p>}
          >
            {(endpoint) => (
              <article class={styles.endpointCard}>
                <div class={styles.endpointHeading}>
                  <div>
                    <strong>{endpoint.description || "Webhook endpoint"}</strong>
                    <code>{endpoint.url}</code>
                  </div>
                  <span class={styles[endpoint.status]}>{endpoint.status}</span>
                </div>
                <p>{endpoint.subscribedEventTypes.map(eventLabel).join(", ")}</p>
                <Show when={endpoint.disabledReason}>
                  <p class={styles.failure}>{endpoint.disabledReason}</p>
                </Show>
                <div class={styles.actions}>
                  <button
                    class="secondary-button compact-button"
                    type="button"
                    onClick={() =>
                      run(
                        () => sendTest.mutate({ endpointId: endpoint.id }),
                        "Test delivery queued.",
                      )
                    }
                  >
                    Send test
                  </button>
                  <button
                    class="secondary-button compact-button"
                    type="button"
                    onClick={() =>
                      run(
                        () =>
                          updateEndpoint.mutate({
                            endpointId: endpoint.id,
                            url: endpoint.url,
                            description: endpoint.description,
                            subscribedEventTypes: endpoint.subscribedEventTypes,
                            status: endpoint.status === "active" ? "disabled" : "active",
                          }),
                        endpoint.status === "active" ? "Endpoint disabled." : "Endpoint enabled.",
                      )
                    }
                  >
                    {endpoint.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button
                    class="secondary-button compact-button"
                    type="button"
                    onClick={() => rotate(endpoint.id)}
                  >
                    Rotate secret
                  </button>
                  <button
                    class={styles.deleteButton}
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete ${endpoint.url}?`)) {
                        void run(
                          () => deleteEndpoint.mutate({ endpointId: endpoint.id }),
                          "Endpoint deleted.",
                        );
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>

        <Show when={(deliveries.data()?.length ?? 0) > 0}>
          <div class={styles.deliveries}>
            <h3>Recent deliveries</h3>
            <For each={deliveries.data()}>
              {(delivery) => (
                <div class={styles.deliveryRow}>
                  <div>
                    <strong>{eventLabel(delivery.eventType)}</strong>
                    <span>{new Date(delivery.createdAt).toLocaleString()}</span>
                  </div>
                  <span class={styles[delivery.status]}>{delivery.status}</span>
                  <span>{delivery.attemptCount} attempts</span>
                  <Show when={delivery.status === "failed"}>
                    <button
                      class="secondary-button compact-button"
                      type="button"
                      onClick={() =>
                        run(
                          () => retryDelivery.mutate({ deliveryId: delivery.id }),
                          "Delivery queued for retry.",
                        )
                      }
                    >
                      Retry
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  );
}
