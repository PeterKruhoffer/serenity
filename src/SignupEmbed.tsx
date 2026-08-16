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

export const createAttendeeKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");

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
    <main class="signup-embed">
      <Show when={!event.isLoading()} fallback={<p class="embed-loading">Loading sign-up form…</p>}>
        <Show
          when={event.data()}
          fallback={
            <section class="embed-message" role="status">
              <strong>This sign-up form is unavailable.</strong>
              <span>The event may not be published or may have ended.</span>
            </section>
          }
        >
          {(details) => (
            <Show
              when={!complete()}
              fallback={
                <section class="embed-message embed-success" role="status">
                  <span aria-hidden="true">✓</span>
                  <strong>You’re registered.</strong>
                  <span>We’ve saved your sign-up for {details().title}.</span>
                </section>
              }
            >
              <form class="embed-form" onSubmit={handleSubmit}>
                <header class="embed-heading">
                  <p>{details().organizationName}</p>
                  <h1>{details().title}</h1>
                  <Show when={details().description}>
                    <span>{details().description}</span>
                  </Show>
                </header>

                <div class="embed-fields">
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
                    {(field) => (
                      <fieldset class="embed-field">
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
                            <div class="embed-options horizontal-options">
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
                            <div class="embed-options">
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
                    )}
                  </For>
                </div>

                <Show when={error()}>
                  <p class="embed-error" role="alert">
                    {error()}
                  </p>
                </Show>
                <button
                  class="primary-button embed-submit"
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
                <small class="embed-credit">Registration powered by Serenity</small>
              </form>
            </Show>
          )}
        </Show>
      </Show>
    </main>
  );
};

export default SignupEmbed;
