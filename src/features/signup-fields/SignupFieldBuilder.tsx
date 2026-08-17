import { For, Show, type JSX } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

export type SignupFieldType = "text" | "textarea" | "yes_no" | "checkboxes";

export type SignupFieldPayload = {
  type: SignupFieldType;
  label: string;
  required: boolean;
  options: string[];
};

type DraftSignupField = SignupFieldPayload & { id: string };
type SavedSignupField = Omit<SignupFieldPayload, "options"> & {
  readonly options: readonly string[];
};

let fieldId = 0;
const draftField = (field: SavedSignupField): DraftSignupField => ({
  ...field,
  id: `signup-field-${++fieldId}`,
  options: [...field.options],
});

export const createSignupFields = () => {
  const [fields, setFieldStore] = createStore<DraftSignupField[]>([]);
  const setFields = (
    update: DraftSignupField[] | ((fields: DraftSignupField[]) => DraftSignupField[]),
  ) => {
    const next = typeof update === "function" ? update([...fields]) : update;
    setFieldStore(reconcile(next, { key: "id" }));
  };
  const update = (id: string, change: (field: DraftSignupField) => DraftSignupField) => {
    const index = fields.findIndex((field) => field.id === id);
    if (index >= 0) setFieldStore(index, change(fields[index]!));
  };

  return {
    fields,
    get length() {
      return fields.length;
    },
    payload: (): SignupFieldPayload[] =>
      fields.map(({ type, label, required, options }) => ({ type, label, required, options })),
    replace: (next: readonly SavedSignupField[]) => setFields(next.map(draftField)),
    reset: () => setFields([]),
    add: (type: SignupFieldType) =>
      setFields((current) => [
        ...current,
        draftField({
          type,
          label: "",
          required: false,
          options: type === "checkboxes" ? [""] : [],
        }),
      ]),
    remove: (id: string) => setFields((current) => current.filter((field) => field.id !== id)),
    move: (id: string, offset: -1 | 1) =>
      setFields((current) => {
        const index = current.findIndex((field) => field.id === id);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      }),
    update,
  };
};

export type SignupFieldsController = ReturnType<typeof createSignupFields>;

type SignupFieldBuilderProps = {
  controller: SignupFieldsController;
  class?: string;
  emptyTitle: string;
  emptyText: string;
  paletteAriaLabel: string;
  children?: JSX.Element;
};

export const SignupFieldBuilder = (props: SignupFieldBuilderProps) => {
  const labels: Record<SignupFieldType, string> = {
    text: "Short answer",
    textarea: "Long answer",
    yes_no: "Yes or no",
    checkboxes: "Checkboxes",
  };
  return (
    <div class={`signup-builder${props.class ? ` ${props.class}` : ""}`}>
      {props.children}
      <Show
        when={props.controller.length > 0}
        fallback={
          <div class="signup-empty-state">
            <strong>{props.emptyTitle}</strong>
            <span>{props.emptyText}</span>
          </div>
        }
      >
        <div class="signup-field-list">
          <For each={props.controller.fields}>
            {(field, index) => (
              <section class="signup-field-card">
                <div class="signup-field-heading">
                  <span>{index() + 1}</span>
                  <strong>{labels[field.type]}</strong>
                  <div class="signup-field-actions">
                    <button
                      class="text-button"
                      type="button"
                      aria-label={`Move ${field.label || "field"} up`}
                      disabled={index() === 0}
                      onClick={() => props.controller.move(field.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      class="text-button"
                      type="button"
                      aria-label={`Move ${field.label || "field"} down`}
                      disabled={index() === props.controller.length - 1}
                      onClick={() => props.controller.move(field.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      class="text-button danger-button"
                      type="button"
                      onClick={() => props.controller.remove(field.id)}
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
                        props.controller.update(field.id, (item) => ({
                          ...item,
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
                        props.controller.update(field.id, (item) => {
                          const type = event.currentTarget.value as SignupFieldType;
                          return {
                            ...item,
                            type,
                            options:
                              type === "checkboxes"
                                ? item.options.length
                                  ? item.options
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
                        props.controller.update(field.id, (item) => ({
                          ...item,
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
                              props.controller.update(field.id, (item) => ({
                                ...item,
                                options: item.options.map((value, i) =>
                                  i === optionIndex() ? event.currentTarget.value : value,
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
                                props.controller.update(field.id, (item) => ({
                                  ...item,
                                  options: item.options.filter((_, i) => i !== optionIndex()),
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
                        props.controller.update(field.id, (item) => ({
                          ...item,
                          options: [...item.options, ""],
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
      <div class="signup-field-palette" aria-label={props.paletteAriaLabel}>
        <span>Add field</span>
        <For each={Object.entries(labels) as [SignupFieldType, string][]}>
          {([type, label]) => (
            <button
              class="secondary-button compact-button"
              type="button"
              onClick={() => props.controller.add(type)}
            >
              ＋ {label}
            </button>
          )}
        </For>
      </div>
    </div>
  );
};
