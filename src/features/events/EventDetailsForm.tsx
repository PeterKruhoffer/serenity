import styles from "./events.module.css";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useMutation } from "convex-solidjs";
import { Show } from "solid-js";
import { createStore } from "solid-js/store";
import { FormError } from "../../components/form-error";
import { convexErrorMessage } from "../../lib/convex-error-message";
import {
  LockedSignupFields,
  SignupFieldBuilder,
  createSignupFields,
  type SignupFieldPayload,
} from "../signup-fields/SignupFieldBuilder";

type SavedSignupField = Omit<SignupFieldPayload, "options"> & {
  readonly options: readonly string[];
};

type EventDetailsFormProps = {
  eventId: Id<"events">;
  title: string;
  description: string;
  signupTemplate?: { name: string; fields: readonly SavedSignupField[] };
  signupFields: readonly SavedSignupField[];
  onClose: () => void;
};

export const MarkdownHint = () => (
  <small class={styles.markdownHint}>
    Formatting: **bold**, *italic*, a "- " at the start of a line for lists, and [link
    text](https://example.com) for links.
  </small>
);

// Starts from the saved draft once; later server updates do not overwrite edits in progress.
const EventDetailsForm = (props: EventDetailsFormProps) => {
  const updateDetails = useMutation(api.events.updateDetails);
  const signupFields = createSignupFields();
  signupFields.replace(props.signupFields);
  const [form, setForm] = createStore({
    title: props.title,
    description: props.description,
    error: null as string | null,
  });

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setForm("error", null);
    try {
      await updateDetails.mutate({
        eventId: props.eventId,
        title: form.title,
        description: form.description,
        signupFields: signupFields.payload(),
      });
      props.onClose();
    } catch (error) {
      setForm("error", convexErrorMessage(error));
    }
  };

  return (
    <form class={styles.detailsForm} onSubmit={handleSubmit} aria-label="Edit event details">
      <div class={styles.builderSectionHeading}>
        <span>01</span>
        <div>
          <h3>Event details</h3>
          <p>Changes go live after the next revision is approved.</p>
        </div>
      </div>
      <div class="form-grid">
        <label class="wide-field">
          <span>Event title</span>
          <input
            value={form.title}
            onInput={(event) => setForm("title", event.currentTarget.value)}
            required
          />
        </label>
        <label class="wide-field">
          <span>Description</span>
          <textarea
            placeholder="What participants will learn and experience"
            value={form.description}
            onInput={(event) => setForm("description", event.currentTarget.value)}
            rows="5"
          />
          <MarkdownHint />
        </label>
      </div>
      <div class={`${styles.builderSectionHeading} ${styles.signupHeading}`}>
        <span>02</span>
        <div>
          <h3>Sign-up form</h3>
          <p>Answers already collected keep the questions they were given against.</p>
        </div>
      </div>
      <SignupFieldBuilder
        controller={signupFields}
        emptyTitle={
          props.signupTemplate ? "No event-specific questions" : "No custom questions yet"
        }
        emptyText="Add a field below, or leave the form empty for a simple sign-up."
        paletteAriaLabel="Add a sign-up field"
      >
        <Show when={props.signupTemplate}>
          {(template) => (
            <LockedSignupFields
              title={`From ${template().name}`}
              note="Edit the template to change these."
              fields={template().fields}
            />
          )}
        </Show>
      </SignupFieldBuilder>
      <Show when={form.error}>
        <FormError>{form.error}</FormError>
      </Show>
      <div class="form-actions">
        <button class="primary-button" type="submit" disabled={updateDetails.isLoading()}>
          {updateDetails.isLoading() ? "Saving…" : "Save changes"}
        </button>
        <button class="text-button" type="button" onClick={() => props.onClose()}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EventDetailsForm;
