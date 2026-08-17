import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../../components/empty-state";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { convexErrorMessage } from "../../lib/convex-error-message";
import { SignupFieldBuilder, createSignupFields } from "../signup-fields/SignupFieldBuilder";
import { useWorkspace } from "../workspace/WorkspaceLayout";

export default function TemplatesPage() {
  const { activeOrganization: organization } = useWorkspace();
  const templates = useQuery(
    api.events.listSignupTemplates,
    () => ({ organizationId: organization()?.id ?? ("" as Id<"organizations">) }),
    () => ({ enabled: Boolean(organization()) }),
  );
  const saveTemplate = useMutation(api.events.saveSignupTemplate);
  const updateTemplate = useMutation(api.events.updateSignupTemplate);
  const deleteTemplate = useMutation(api.events.deleteSignupTemplate);
  const [formError, setFormError] = createSignal<string | null>(null);
  const fields = createSignupFields();
  const [name, setName] = createSignal("");
  const [scope, setScope] = createSignal<"organization" | "team">("organization");
  const [teamId, setTeamId] = createSignal<Id<"teams"> | "">("");
  const [editingId, setEditingId] = createSignal<Id<"signup_form_templates"> | null>(null);
  const [showForm, setShowForm] = createSignal(false);
  const reset = () => {
    setName("");
    setScope(organization()?.role === "event_manager" ? "team" : "organization");
    setTeamId(organization()?.teams[0]?.id ?? "");
    fields.reset();
    setEditingId(null);
    setShowForm(false);
  };
  const openNew = () => {
    if (showForm()) return reset();
    reset();
    setShowForm(true);
  };
  const edit = (id: Id<"signup_form_templates">) => {
    const template = templates.data()?.find((item) => item.id === id);
    if (!template) return;
    setFormError(null);
    setEditingId(id);
    setName(template.name);
    setScope(template.scope);
    setTeamId(template.teamId ?? organization()?.teams[0]?.id ?? "");
    fields.replace(template.fields);
    setShowForm(true);
  };
  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    const org = organization();
    if (!org || fields.length === 0) return;
    setFormError(null);
    const payload = {
      ...(scope() === "team" && (teamId() || org.teams[0]?.id)
        ? { teamId: (teamId() || org.teams[0]!.id) as Id<"teams"> }
        : {}),
      name: name(),
      scope: scope(),
      fields: fields.payload(),
    };
    try {
      const id = editingId();
      if (id) await updateTemplate.mutate({ templateId: id, ...payload });
      else await saveTemplate.mutate({ organizationId: org.id, ...payload });
      reset();
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };
  const remove = async (id: Id<"signup_form_templates">, templateName: string) => {
    if (
      !window.confirm(
        `Delete “${templateName}”? Events already created from it will not be changed.`,
      )
    )
      return;
    setFormError(null);
    try {
      await deleteTemplate.mutate({ templateId: id });
      if (editingId() === id) reset();
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };

  return (
    <Page.Root labelledBy="templates-page-title">
      <Page.Header variant="page">
        <Page.Heading>
          <Page.Eyebrow>Reusable sign-up forms</Page.Eyebrow>
          <Page.Title id="templates-page-title">Templates</Page.Title>
          <Page.Description>
            Create forms once, then use them for events across your organization or within a
            specific team.
          </Page.Description>
        </Page.Heading>
        <button
          class="primary-button"
          type="button"
          disabled={organization()?.teams.length === 0}
          onClick={openNew}
        >
          {showForm() ? "Close" : "New template"} <span aria-hidden="true">＋</span>
        </button>
      </Page.Header>
      <Show when={showForm() && organization()}>
        {(org) => (
          <form class="template-editor-form" onSubmit={save}>
            <div class="form-heading">
              <div>
                <p class="eyebrow">{editingId() ? "Edit template" : "New template"}</p>
                <h2>{editingId() ? name() : "Build a sign-up form"}</h2>
                <p>Changes affect future uses only, not events already created.</p>
              </div>
            </div>
            <div class="form-grid template-details-grid">
              <label class="wide-field">
                <span>Template name</span>
                <input
                  placeholder="Standard attendee questions"
                  value={name()}
                  onInput={(event) => setName(event.currentTarget.value)}
                  required
                  autofocus
                />
              </label>
              <label>
                <span>Available to</span>
                <select
                  value={scope()}
                  onChange={(event) =>
                    setScope(event.currentTarget.value as "organization" | "team")
                  }
                >
                  <Show when={org().role !== "event_manager"}>
                    <option value="organization">Entire organization</option>
                  </Show>
                  <option value="team">Specific team</option>
                </select>
              </label>
              <Show when={scope() === "team"}>
                <label>
                  <span>Team</span>
                  <select
                    value={teamId() || org().teams[0]?.id}
                    onChange={(event) => setTeamId(event.currentTarget.value as Id<"teams">)}
                    required
                  >
                    <For each={org().teams}>
                      {(team) => <option value={team.id}>{team.name}</option>}
                    </For>
                  </select>
                </label>
              </Show>
            </div>
            <SignupFieldBuilder
              controller={fields}
              class="template-field-builder"
              emptyTitle="No questions yet"
              emptyText="Add the first field to start building this template."
              paletteAriaLabel="Add a template field"
            />
            <Show when={formError()}>
              <FormError>{formError()}</FormError>
            </Show>
            <div class="form-actions">
              <button
                class="primary-button"
                type="submit"
                disabled={
                  !name().trim() ||
                  fields.length === 0 ||
                  saveTemplate.isLoading() ||
                  updateTemplate.isLoading()
                }
              >
                {saveTemplate.isLoading() || updateTemplate.isLoading()
                  ? "Saving…"
                  : editingId()
                    ? "Save changes"
                    : "Create template"}
              </button>
              <button class="text-button" type="button" onClick={reset}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Show>
      <section class="templates-section" aria-labelledby="saved-templates-title">
        <SectionHeader.Root>
          <SectionHeader.Heading>
            <SectionHeader.Eyebrow>Form library</SectionHeader.Eyebrow>
            <SectionHeader.Title id="saved-templates-title">Saved templates</SectionHeader.Title>
          </SectionHeader.Heading>
          <SectionHeader.Count>{templates.data()?.length ?? 0} templates</SectionHeader.Count>
        </SectionHeader.Root>
        <Show when={formError() && !showForm()}>
          <FormError>{formError()}</FormError>
        </Show>
        <Show
          when={(templates.data()?.length ?? 0) > 0}
          fallback={
            <EmptyState.Root class="template-library-empty">
              <EmptyState.Title as="strong">No templates yet</EmptyState.Title>
              <EmptyState.Description>
                Create a reusable form to make event setup faster and consistent.
              </EmptyState.Description>
            </EmptyState.Root>
          }
        >
          <div class="template-grid">
            <For each={templates.data()}>
              {(template) => {
                const canManage = () =>
                  organization()?.role !== "event_manager" || template.scope === "team";
                const teamName = () =>
                  organization()?.teams.find((team) => team.id === template.teamId)?.name;
                return (
                  <article class="template-card">
                    <div class="template-card-heading">
                      <span classList={{ "organization-scope": template.scope === "organization" }}>
                        {template.scope === "organization" ? "Organization" : teamName() || "Team"}
                      </span>
                      <div class="template-card-actions">
                        <Show when={canManage()}>
                          <button
                            class="text-button"
                            type="button"
                            onClick={() => edit(template.id)}
                          >
                            Edit
                          </button>
                          <button
                            class="text-button danger-button"
                            type="button"
                            disabled={deleteTemplate.isLoading()}
                            onClick={() => void remove(template.id, template.name)}
                          >
                            Delete
                          </button>
                        </Show>
                      </div>
                    </div>
                    <h3>{template.name}</h3>
                    <p>
                      {template.fields.length} question{template.fields.length === 1 ? "" : "s"}
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
    </Page.Root>
  );
}
