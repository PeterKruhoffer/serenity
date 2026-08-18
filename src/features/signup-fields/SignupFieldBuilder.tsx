import { For, Show, createSignal, type JSX } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

export type SignupFieldType = "text" | "textarea" | "yes_no" | "checkboxes";

export type SignupFieldPayload = {
  type: SignupFieldType;
  label: string;
  required: boolean;
  options: string[];
  section?: string;
};

type DraftSignupField = SignupFieldPayload & { id: string; kind: "field" };
type DraftSignupSection = { id: string; kind: "section"; title: string };
type DraftSignupItem = DraftSignupField | DraftSignupSection;
type SavedSignupField = Omit<SignupFieldPayload, "options"> & {
  readonly options: readonly string[];
};

let fieldId = 0;
const draftField = (field: SavedSignupField): DraftSignupField => ({
  ...field,
  id: `signup-field-${++fieldId}`,
  kind: "field",
  options: [...field.options],
});

const draftItems = (fields: readonly SavedSignupField[]): DraftSignupItem[] => {
  let activeSection: string | undefined;
  return fields.flatMap((field) => {
    const items: DraftSignupItem[] = [];
    if (field.section && field.section !== activeSection) {
      activeSection = field.section;
      items.push({ id: `signup-section-${++fieldId}`, kind: "section", title: field.section });
    } else if (!field.section) {
      activeSection = undefined;
    }
    items.push(draftField(field));
    return items;
  });
};

export const createSignupFields = () => {
  const [items, setItemStore] = createStore<DraftSignupItem[]>([]);
  const setItems = (
    update: DraftSignupItem[] | ((items: DraftSignupItem[]) => DraftSignupItem[]),
  ) => {
    const next = typeof update === "function" ? update([...items]) : update;
    setItemStore(reconcile(next, { key: "id" }));
  };
  const update = (id: string, change: (field: DraftSignupField) => DraftSignupField) => {
    const index = items.findIndex((item) => item.id === id);
    const item = items[index];
    if (index >= 0 && item?.kind === "field") setItemStore(index, change(item));
  };

  return {
    items,
    get length() {
      return items.filter((item) => item.kind === "field").length;
    },
    payload: (): SignupFieldPayload[] => {
      let section: string | undefined;
      return items.flatMap((item) => {
        if (item.kind === "section") {
          section = item.title;
          return [];
        }
        const { type, label, required, options } = item;
        return [{ type, label, required, options, ...(section ? { section } : {}) }];
      });
    },
    replace: (next: readonly SavedSignupField[]) => setItems(draftItems(next)),
    reset: () => setItems([]),
    add: (type: SignupFieldType) =>
      setItems((current) => [
        ...current,
        draftField({
          type,
          label: "",
          required: false,
          options: type === "checkboxes" ? [""] : [],
        }),
      ]),
    addSection: () =>
      setItems((current) => [
        ...current,
        { id: `signup-section-${++fieldId}`, kind: "section", title: "" },
      ]),
    remove: (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    move: (id: string, offset: -1 | 1) =>
      setItems((current) => {
        const index = current.findIndex((item) => item.id === id);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= current.length) return current;
        const next = [...current];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      }),
    reorder: (id: string, targetId: string, position: "before" | "after") =>
      setItems((current) => {
        const from = current.findIndex((item) => item.id === id);
        const target = current.findIndex((item) => item.id === targetId);
        if (from < 0 || target < 0 || from === target) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        const adjustedTarget = next.findIndex((item) => item.id === targetId);
        next.splice(adjustedTarget + (position === "after" ? 1 : 0), 0, moved!);
        return next;
      }),
    fieldNumber: (id: string) =>
      items.filter((item) => item.kind === "field").findIndex((item) => item.id === id) + 1,
    sectionColorClass: (id: string) => {
      let sectionIndex = -1;
      for (const item of items) {
        if (item.kind === "section") sectionIndex += 1;
        if (item.id === id) {
          return sectionIndex >= 0 ? `section-color-${sectionIndex % 4}` : "";
        }
      }
      return "";
    },
    update,
    updateSection: (id: string, title: string) => {
      const index = items.findIndex((item) => item.id === id);
      const item = items[index];
      if (index >= 0 && item?.kind === "section") setItemStore(index, { ...item, title });
    },
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
  const [draggedId, setDraggedId] = createSignal<string>();
  const [dropTarget, setDropTarget] = createSignal<{
    id: string;
    position: "before" | "after";
  }>();
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
        when={props.controller.items.length > 0}
        fallback={
          <div class="signup-empty-state">
            <strong>{props.emptyTitle}</strong>
            <span>{props.emptyText}</span>
          </div>
        }
      >
        <div class="signup-field-list" aria-label="Sign-up form fields and sections">
          <For each={props.controller.items}>
            {(item, index) => {
              const dragHandle = (
                <button
                  class="signup-drag-handle"
                  type="button"
                  draggable={true}
                  aria-label={`Drag ${item.kind === "section" ? item.title || "section" : item.label || "field"}`}
                  title="Drag to reorder"
                  onDragStart={(event) => {
                    setDraggedId(item.id);
                    event.dataTransfer?.setData("text/plain", item.id);
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggedId();
                    setDropTarget();
                  }}
                >
                  <span aria-hidden="true">⠿</span>
                </button>
              );
              const dragTargetProps = {
                onDragOver: (event: DragEvent) => {
                  if (!draggedId() || draggedId() === item.id) return;
                  event.preventDefault();
                  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
                  const position =
                    event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
                  setDropTarget({ id: item.id, position });
                },
                onDrop: (event: DragEvent) => {
                  event.preventDefault();
                  const source = draggedId() || event.dataTransfer?.getData("text/plain");
                  const target = dropTarget();
                  if (source && target?.id === item.id) {
                    props.controller.reorder(source, item.id, target.position);
                  }
                  setDraggedId();
                  setDropTarget();
                },
              };
              return item.kind === "section" ? (
                <div
                  class={`signup-section-divider ${props.controller.sectionColorClass(item.id)}`}
                  classList={{
                    "is-dragging": draggedId() === item.id,
                    "drop-before":
                      dropTarget()?.id === item.id && dropTarget()?.position === "before",
                    "drop-after":
                      dropTarget()?.id === item.id && dropTarget()?.position === "after",
                  }}
                  {...dragTargetProps}
                >
                  {dragHandle}
                  <label>
                    <span>Section</span>
                    <input
                      placeholder="About you"
                      value={item.title}
                      onInput={(event) =>
                        props.controller.updateSection(item.id, event.currentTarget.value)
                      }
                      required
                    />
                  </label>
                  <div class="signup-field-actions">
                    <button
                      class="text-button"
                      type="button"
                      aria-label={`Move ${item.title || "section"} up`}
                      disabled={index() === 0}
                      onClick={() => props.controller.move(item.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      class="text-button"
                      type="button"
                      aria-label={`Move ${item.title || "section"} down`}
                      disabled={index() === props.controller.items.length - 1}
                      onClick={() => props.controller.move(item.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      class="text-button danger-button"
                      type="button"
                      onClick={() => props.controller.remove(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <section
                  class={`signup-field-card ${props.controller.sectionColorClass(item.id)}`}
                  classList={{
                    "is-dragging": draggedId() === item.id,
                    "drop-before":
                      dropTarget()?.id === item.id && dropTarget()?.position === "before",
                    "drop-after":
                      dropTarget()?.id === item.id && dropTarget()?.position === "after",
                  }}
                  {...dragTargetProps}
                >
                  <div class="signup-field-heading">
                    {dragHandle}
                    <span>{props.controller.fieldNumber(item.id)}</span>
                    <strong>{labels[item.type]}</strong>
                    <div class="signup-field-actions">
                      <button
                        class="text-button"
                        type="button"
                        aria-label={`Move ${item.label || "field"} up`}
                        disabled={index() === 0}
                        onClick={() => props.controller.move(item.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        class="text-button"
                        type="button"
                        aria-label={`Move ${item.label || "field"} down`}
                        disabled={index() === props.controller.items.length - 1}
                        onClick={() => props.controller.move(item.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        class="text-button danger-button"
                        type="button"
                        onClick={() => props.controller.remove(item.id)}
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
                        value={item.label}
                        onInput={(event) =>
                          props.controller.update(item.id, (field) => ({
                            ...field,
                            label: event.currentTarget.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Answer type</span>
                      <select
                        value={item.type}
                        onChange={(event) =>
                          props.controller.update(item.id, (field) => {
                            const type = event.currentTarget.value as SignupFieldType;
                            return {
                              ...field,
                              type,
                              options:
                                type === "checkboxes"
                                  ? field.options.length
                                    ? field.options
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
                        checked={item.required}
                        onChange={(event) =>
                          props.controller.update(item.id, (field) => ({
                            ...field,
                            required: event.currentTarget.checked,
                          }))
                        }
                      />
                      <span>Required</span>
                    </label>
                  </div>
                  <Show when={item.type === "checkboxes"}>
                    <div class="signup-options">
                      <span>Choices</span>
                      <For each={item.options}>
                        {(option, optionIndex) => (
                          <div>
                            <input
                              aria-label={`Choice ${optionIndex() + 1}`}
                              placeholder={`Choice ${optionIndex() + 1}`}
                              value={option}
                              onInput={(event) =>
                                props.controller.update(item.id, (field) => ({
                                  ...field,
                                  options: field.options.map((value, i) =>
                                    i === optionIndex() ? event.currentTarget.value : value,
                                  ),
                                }))
                              }
                              required
                            />
                            <Show when={item.options.length > 1}>
                              <button
                                class="text-button danger-button"
                                type="button"
                                aria-label={`Remove choice ${optionIndex() + 1}`}
                                onClick={() =>
                                  props.controller.update(item.id, (field) => ({
                                    ...field,
                                    options: field.options.filter((_, i) => i !== optionIndex()),
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
                          props.controller.update(item.id, (field) => ({
                            ...field,
                            options: [...field.options, ""],
                          }))
                        }
                      >
                        ＋ Add choice
                      </button>
                    </div>
                  </Show>
                </section>
              );
            }}
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
        <button
          class="secondary-button compact-button add-section-button"
          type="button"
          onClick={props.controller.addSection}
        >
          ＋ Section
        </button>
      </div>
    </div>
  );
};
