import styles from "./events.module.css";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex-solidjs";
import { Show } from "solid-js";
import { createStore } from "solid-js/store";
import { FormError } from "../../components/form-error";
import { convexErrorMessage } from "../../lib/convex-error-message";

type RegistrationSettingsProps = {
  eventId: Id<"events">;
  editable: boolean;
  settings: {
    capacity: number;
    autoAccept: boolean;
    waitingListEnabled: boolean;
    acceptedCount: number;
  };
};

const outcome = (capacity: number, autoAccept: boolean, waitingListEnabled: boolean) => {
  if (!autoAccept) {
    return `Every sign-up arrives as pending. You accept people from Participants until ${capacity} are accepted. Sign-ups are never refused.`;
  }
  if (waitingListEnabled) {
    return `Sign-ups 1 to ${capacity} are accepted on the spot. From #${capacity + 1}, people join the waiting list and move up when an accepted person withdraws.`;
  }
  return `Sign-ups 1 to ${capacity} are accepted on the spot. #${capacity + 1} is refused because the event is at capacity.`;
};

// Starts from the saved settings once; later server updates do not overwrite edits in progress.
const RegistrationSettings = (props: RegistrationSettingsProps) => {
  const configure = useMutation(api.registrations.configure);
  const [form, setForm] = createStore({
    capacity: String(props.settings.capacity),
    autoAccept: props.settings.autoAccept,
    waitingListEnabled: props.settings.waitingListEnabled,
    error: null as string | null,
  });
  const capacity = () => Number(form.capacity);
  const capacityIsValid = () =>
    Number.isInteger(capacity()) &&
    capacity() >= Math.max(1, props.settings.acceptedCount) &&
    capacity() <= 100_000;
  const isDirty = () =>
    capacity() !== props.settings.capacity ||
    form.autoAccept !== props.settings.autoAccept ||
    form.waitingListEnabled !== props.settings.waitingListEnabled;

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setForm("error", null);
    try {
      await configure.mutate({
        eventId: props.eventId,
        capacity: capacity(),
        autoAccept: form.autoAccept,
        waitingListEnabled: form.waitingListEnabled,
      });
    } catch (error) {
      setForm("error", convexErrorMessage(error));
    }
  };

  return (
    <form
      class={styles.registrationSettings}
      onSubmit={handleSubmit}
      aria-labelledby="registration-settings-title"
    >
      <div class={styles.registrationSettingsHeading}>
        <span>Registration</span>
        <h3 id="registration-settings-title">Who gets a seat</h3>
        <p>
          {props.editable
            ? "Decide how many people get a seat and what happens when the event is full."
            : "Registration settings can only change in a draft. Start a new draft to change them."}
        </p>
      </div>
      <fieldset disabled={!props.editable}>
        <label class={styles.capacityField}>
          <span>Capacity</span>
          <input
            type="number"
            inputmode="numeric"
            min={Math.max(1, props.settings.acceptedCount)}
            max={100_000}
            step={1}
            value={form.capacity}
            onInput={(event) => setForm("capacity", event.currentTarget.value)}
            aria-describedby="registration-capacity-hint"
            required
          />
          <small id="registration-capacity-hint">
            {props.settings.acceptedCount} accepted so far
            {props.settings.acceptedCount > 0
              ? `, so capacity can't go below ${props.settings.acceptedCount}.`
              : "."}
          </small>
        </label>
        <label class={styles.registrationToggle}>
          <input
            type="checkbox"
            role="switch"
            checked={form.autoAccept}
            onChange={(event) => setForm("autoAccept", event.currentTarget.checked)}
          />
          <span>
            <strong>Accept automatically</strong>
            <small>
              {form.autoAccept
                ? "People get a seat as soon as they sign up, while seats remain."
                : "Each sign-up waits as pending until someone on your team accepts it."}
            </small>
          </span>
        </label>
        <label class={styles.registrationToggle}>
          <input
            type="checkbox"
            role="switch"
            checked={form.autoAccept && form.waitingListEnabled}
            disabled={!form.autoAccept}
            onChange={(event) => setForm("waitingListEnabled", event.currentTarget.checked)}
          />
          <span>
            <strong>Waiting list</strong>
            <small>
              {form.autoAccept
                ? "When the event is full, new sign-ups queue up instead of being turned away."
                : "Only applies with automatic acceptance."}
            </small>
          </span>
        </label>
      </fieldset>
      <p class={styles.registrationOutcome}>
        {capacityIsValid()
          ? outcome(capacity(), form.autoAccept, form.waitingListEnabled)
          : `Capacity must be a whole number from ${Math.max(1, props.settings.acceptedCount)} to 100,000.`}
      </p>
      <Show when={form.error}>
        <FormError>{form.error}</FormError>
      </Show>
      <Show when={props.editable}>
        <button
          class={`secondary-button compact-button ${styles.inverseButton}`}
          type="submit"
          disabled={!capacityIsValid() || !isDirty() || configure.isLoading()}
        >
          {configure.isLoading() ? "Saving…" : isDirty() ? "Save registration" : "Saved"}
        </button>
      </Show>
    </form>
  );
};

export default RegistrationSettings;
