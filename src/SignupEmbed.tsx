import styles from "./SignupEmbed.module.css";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useParams } from "@solidjs/router";
import { useMutation, useQuery } from "convex-solidjs";
import {
  For,
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import { createStore } from "solid-js/store";

type AnswerValue = string | boolean | string[];

const attendeeStorageKey = "serenity-attendee-key";
const sectionColorClasses = [
  styles.sectionColor0,
  styles.sectionColor1,
  styles.sectionColor2,
  styles.sectionColor3,
] as const;

export const createAttendeeKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");

const sectionColorClass = (fields: ReadonlyArray<{ section?: string }>, fieldIndex: number) => {
  let activeSection: string | undefined;
  let sectionIndex = -1;
  for (let index = 0; index <= fieldIndex; index += 1) {
    const section = fields[index]?.section;
    if (section && section !== activeSection) sectionIndex += 1;
    activeSection = section;
  }
  return sectionIndex >= 0 ? sectionColorClasses[sectionIndex % sectionColorClasses.length]! : "";
};

const attendeeKey = () => {
  try {
    const stored = localStorage.getItem(attendeeStorageKey);
    if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
    const created = createAttendeeKey();
    localStorage.setItem(attendeeStorageKey, created);
    return created;
  } catch {
    return createAttendeeKey();
  }
};

const mutationError = (error: unknown) => {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  return error instanceof Error ? error.message : "Registration could not be completed.";
};

const SignupEmbed: Component = () => {
  const params = useParams<{ eventId: string }>();
  const eventId = () => params.eventId as Id<"events">;
  const event = useQuery(api.attendee.getEvent, () => ({ eventId: eventId() }));
  const register = useMutation(api.attendee.register);
  const [displayName, setDisplayName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [answers, setAnswers] = createStore<Record<string, AnswerValue | undefined>>({});
  const [error, setError] = createSignal<string | null>(null);
  const [complete, setComplete] = createSignal(false);

  onMount(() => {
    if (window.parent === window || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: "serenity.embed.resize", eventId: eventId(), height: document.body.scrollHeight },
        "*",
      );
    });
    observer.observe(document.body);
    onCleanup(() => observer.disconnect());
  });

  const toggleChoice = (fieldId: string, choice: string, checked: boolean) => {
    const current = answers[fieldId];
    const selected = Array.isArray(current) ? current : [];
    setAnswers(
      fieldId,
      checked ? [...selected, choice] : selected.filter((value) => value !== choice),
    );
  };

  const handleSubmit = async (submitEvent: SubmitEvent) => {
    submitEvent.preventDefault();
    const details = event.data();
    if (!details) return;
    setError(null);
    try {
      const result = await register.mutate({
        attendeeKey: attendeeKey(),
        eventId: details.id,
        displayName: displayName(),
        email: email(),
        locale: navigator.language,
        answers: details.signupFields.flatMap((field) => {
          const value = answers[field.id];
          return value === undefined ? [] : [{ fieldId: field.id, value }];
        }),
      });
      setComplete(true);
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "serenity.signup.complete",
            eventId: details.id,
            registrationId: result.registrationId,
            status: result.status,
          },
          "*",
        );
      }
    } catch (registrationError) {
      setError(mutationError(registrationError));
    }
  };

  return (
    <main class={styles.signupEmbed}>
      <Show
        when={!event.isLoading()}
        fallback={<p class={styles.embedLoading}>Loading sign-up form…</p>}
      >
        <Show
          when={event.data()}
          fallback={
            <section class={styles.embedMessage} role="status">
              <strong>This sign-up form is unavailable.</strong>
              <span>The event may not be published or may have ended.</span>
            </section>
          }
        >
          {(details) => (
            <Show
              when={!complete()}
              fallback={
                <section class={`${styles.embedMessage} ${styles.embedSuccess}`} role="status">
                  <span aria-hidden="true">✓</span>
                  <strong>You’re registered.</strong>
                  <span>We’ve saved your sign-up for {details().title}.</span>
                </section>
              }
            >
              <form class={styles.embedForm} onSubmit={handleSubmit}>
                <header class={styles.embedHeading}>
                  <p>{details().organizationName}</p>
                  <h1>{details().title}</h1>
                  <Show when={details().description}>
                    <span>{details().description}</span>
                  </Show>
                </header>

                <div class={styles.embedFields}>
                  <label>
                    <span>
                      Name <em>Required</em>
                    </span>
                    <input
                      autocomplete="name"
                      value={displayName()}
                      onInput={(inputEvent) => setDisplayName(inputEvent.currentTarget.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      autocomplete="email"
                      value={email()}
                      onInput={(inputEvent) => setEmail(inputEvent.currentTarget.value)}
                    />
                  </label>

                  <For each={details().signupFields}>
                    {(field, index) => (
                      <>
                        <Show
                          when={
                            field.section &&
                            field.section !== details().signupFields[index() - 1]?.section
                          }
                        >
                          <div
                            class={`${styles.embedSectionHeading} ${sectionColorClass(details().signupFields, index())}`}
                          >
                            <span>Section</span>
                            <h2>{field.section}</h2>
                          </div>
                        </Show>
                        <fieldset
                          class={`${styles.embedField} ${sectionColorClass(details().signupFields, index())}`}
                          classList={{ [styles.inSection]: !!field.section }}
                        >
                          <legend>
                            {field.label}{" "}
                            <Show when={field.required}>
                              <em>Required</em>
                            </Show>
                          </legend>
                          <Switch>
                            <Match when={field.type === "text"}>
                              <input
                                value={(answers[field.id] as string | undefined) ?? ""}
                                onInput={(inputEvent) =>
                                  setAnswers(field.id, inputEvent.currentTarget.value)
                                }
                                required={field.required}
                              />
                            </Match>
                            <Match when={field.type === "textarea"}>
                              <textarea
                                rows="4"
                                value={(answers[field.id] as string | undefined) ?? ""}
                                onInput={(inputEvent) =>
                                  setAnswers(field.id, inputEvent.currentTarget.value)
                                }
                                required={field.required}
                              />
                            </Match>
                            <Match when={field.type === "yes_no"}>
                              <div class={`${styles.embedOptions} ${styles.horizontalOptions}`}>
                                <For each={[true, false]}>
                                  {(value) => (
                                    <label>
                                      <input
                                        type="radio"
                                        name={`answer-${field.id}`}
                                        checked={answers[field.id] === value}
                                        onChange={() => setAnswers(field.id, value)}
                                        required={field.required}
                                      />
                                      <span>{value ? "Yes" : "No"}</span>
                                    </label>
                                  )}
                                </For>
                              </div>
                            </Match>
                            <Match when={field.type === "checkboxes"}>
                              <div class={styles.embedOptions}>
                                <For each={field.options}>
                                  {(option, optionIndex) => (
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={
                                          Array.isArray(answers[field.id]) &&
                                          (answers[field.id] as string[]).includes(option)
                                        }
                                        onChange={(inputEvent) =>
                                          toggleChoice(
                                            field.id,
                                            option,
                                            inputEvent.currentTarget.checked,
                                          )
                                        }
                                        required={
                                          field.required &&
                                          optionIndex() === 0 &&
                                          (!Array.isArray(answers[field.id]) ||
                                            (answers[field.id] as string[]).length === 0)
                                        }
                                      />
                                      <span>{option}</span>
                                    </label>
                                  )}
                                </For>
                              </div>
                            </Match>
                          </Switch>
                        </fieldset>
                      </>
                    )}
                  </For>
                </div>

                <Show when={error()}>
                  <p class={styles.embedError} role="alert">
                    {error()}
                  </p>
                </Show>
                <button
                  class={`primary-button ${styles.embedSubmit}`}
                  type="submit"
                  disabled={register.isLoading() || details().registrationState === "full"}
                >
                  {details().registrationState === "full"
                    ? "Registration is full"
                    : register.isLoading()
                      ? "Submitting…"
                      : details().registrationState === "waitlist"
                        ? "Join waitlist"
                        : "Sign up"}
                </button>
                <small class={styles.embedCredit}>Registration powered by Serenity</small>
              </form>
            </Show>
          )}
        </Show>
      </Show>
    </main>
  );
};

export default SignupEmbed;
