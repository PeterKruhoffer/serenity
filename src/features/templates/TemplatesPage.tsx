import styles from "./templates.module.css";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { useMutation, useQuery } from "convex-solidjs";
import { For, Show, createEffect, createSignal } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../../components/empty-state";
import { FormError } from "../../components/form-error";
import { Page } from "../../components/page";
import { SectionHeader } from "../../components/section-header";
import { convexErrorMessage } from "../../lib/convex-error-message";
import {
  LockedSignupFields,
  SignupFieldBuilder,
  createSignupFields,
} from "../signup-fields/SignupFieldBuilder";
import { useWorkspace } from "../workspace/WorkspaceContext";

export default function TemplatesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ templateId?: string }>();
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
  const [parentTemplateId, setParentTemplateId] = createSignal<Id<"signup_form_templates"> | "">(
    "",
  );
  const [editingId, setEditingId] = createSignal<Id<"signup_form_templates"> | null>(null);
  const [loadedRoute, setLoadedRoute] = createSignal("");
  const showForm = () => location.pathname === "/templates/new" || Boolean(params.templateId);
  const formReady = () => location.pathname === "/templates/new" || editingId() !== null;
  const routeTemplateMissing = () =>
    Boolean(
      params.templateId &&
      !templates.isLoading() &&
      !templates.data()?.some((template) => template.id === params.templateId),
    );
  const selectedTeamId = () => teamId() || organization()?.teams[0]?.id;
  // Masters are one level deep: a template that other templates build on cannot have a master.
  const isMaster = () =>
    Boolean(editingId()) &&
    Boolean(templates.data()?.some((template) => template.parentTemplateId === editingId()));
  const masterOptions = () =>
    templates
      .data()
      ?.filter(
        (template) =>
          template.parentTemplateId === undefined &&
          template.id !== editingId() &&
          (template.scope === "organization" ||
            (scope() === "team" && template.teamId === selectedTeamId())),
      ) ?? [];
  const selectedMaster = () =>
    isMaster() ? undefined : masterOptions().find((template) => template.id === parentTemplateId());
  const clearForm = () => {
    setName("");
    setParentTemplateId("");
    setScope(organization()?.role === "event_manager" ? "team" : "organization");
    setTeamId(organization()?.teams[0]?.id ?? "");
    fields.reset();
    setEditingId(null);
  };
  const closeForm = () => {
    clearForm();
    setLoadedRoute("");
    navigate("/templates");
  };
  const openNew = () => {
    if (showForm()) closeForm();
    else navigate("/templates/new");
  };
  createEffect(() => {
    const route = location.pathname;
    if (loadedRoute() === route) return;
    if (route === "/templates/new") {
      clearForm();
      setLoadedRoute(route);
      return;
    }
    const templateId = params.templateId as Id<"signup_form_templates"> | undefined;
    if (!templateId) return;
    const template = templates.data()?.find((item) => item.id === templateId);
    if (!template) return;
    setFormError(null);
    setEditingId(templateId);
    setName(template.name);
    setScope(template.scope);
    setTeamId(template.teamId ?? organization()?.teams[0]?.id ?? "");
    setParentTemplateId(template.parentTemplateId ?? "");
    fields.replace(template.fields);
    setLoadedRoute(route);
  });
  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    const org = organization();
    if (!org || (fields.length === 0 && !selectedMaster())) return;
    setFormError(null);
    const payload = {
      ...(scope() === "team" && (teamId() || org.teams[0]?.id)
        ? { teamId: (teamId() || org.teams[0]!.id) as Id<"teams"> }
        : {}),
      ...(selectedMaster() ? { parentTemplateId: selectedMaster()!.id } : {}),
      name: name(),
      scope: scope(),
      fields: fields.payload(),
    };
    try {
      const id = editingId();
      if (id) await updateTemplate.mutate({ templateId: id, ...payload });
      else await saveTemplate.mutate({ organizationId: org.id, ...payload });
      closeForm();
    } catch (error) {
      setFormError(convexErrorMessage(error));
    }
  };
  const remove = async (id: Id<"signup_form_templates">, templateName: string) => {
    if (
      !window.confirm(
        `Delete “${templateName}”? Templates still used by events or other templates cannot be deleted.`,
      )
    )
      return;
    setFormError(null);
    try {
      await deleteTemplate.mutate({ templateId: id });
      if (editingId() === id) closeForm();
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
      <Show when={routeTemplateMissing()}>
        <FormError>This template is unavailable or no longer exists.</FormError>
      </Show>
      <Show when={showForm() && formReady() && organization()}>
        {(org) => (
          <form class={styles.templateEditorForm} onSubmit={save}>
            <div class="form-heading">
              <div>
                <p class="eyebrow">{editingId() ? "Edit template" : "New template"}</p>
                <h2>{editingId() ? name() : "Build a sign-up form"}</h2>
                <p>
                  Events using this template pick up changes. Published events get a new revision
                  for review.
                </p>
              </div>
            </div>
            <div class={`form-grid ${styles.templateDetailsGrid}`}>
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
              <Show when={!isMaster() && masterOptions().length > 0}>
                <label>
                  <span>Master template</span>
                  <select
                    value={selectedMaster()?.id ?? ""}
                    onChange={(event) =>
                      setParentTemplateId(
                        event.currentTarget.value as Id<"signup_form_templates"> | "",
                      )
                    }
                  >
                    <option value="">None</option>
                    <For each={masterOptions()}>
                      {(template) => <option value={template.id}>{template.name}</option>}
                    </For>
                  </select>
                </label>
              </Show>
            </div>
            <SignupFieldBuilder
              controller={fields}
              class={styles.templateFieldBuilder}
              emptyTitle={selectedMaster() ? "No extra questions yet" : "No questions yet"}
              emptyText={
                selectedMaster()
                  ? "Add questions that come after the master template's questions."
                  : "Add the first field to start building this template."
              }
              paletteAriaLabel="Add a template field"
            >
              <Show when={selectedMaster()}>
                {(master) => (
                  <LockedSignupFields
                    title={`From ${master().name}`}
                    note="Edit the master template to change these."
                    fields={master().fields}
                  />
                )}
              </Show>
            </SignupFieldBuilder>
            <Show when={formError()}>
              <FormError>{formError()}</FormError>
            </Show>
            <div class="form-actions">
              <button
                class="primary-button"
                type="submit"
                disabled={
                  !name().trim() ||
                  (fields.length === 0 && !selectedMaster()) ||
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
              <button class="text-button" type="button" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Show>
      <section class={styles.templatesSection} aria-labelledby="saved-templates-title">
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
            <EmptyState.Root class={styles.templateLibraryEmpty}>
              <EmptyState.Title as="strong">No templates yet</EmptyState.Title>
              <EmptyState.Description>
                Create a reusable form to make event setup faster and consistent.
              </EmptyState.Description>
            </EmptyState.Root>
          }
        >
          <div class={styles.templateGrid}>
            <For each={templates.data()}>
              {(template) => {
                const canManage = () =>
                  organization()?.role !== "event_manager" || template.scope === "team";
                const teamName = () =>
                  organization()?.teams.find((team) => team.id === template.teamId)?.name;
                const masterName = () =>
                  templates.data()?.find((master) => master.id === template.parentTemplateId)?.name;
                const allFields = () => [...template.inheritedFields, ...template.fields];
                return (
                  <article class={styles.templateCard}>
                    <div class={styles.templateCardHeading}>
                      <span
                        classList={{
                          [styles.organizationScope]: template.scope === "organization",
                        }}
                      >
                        {template.scope === "organization" ? "Organization" : teamName() || "Team"}
                      </span>
                      <div class={styles.templateCardActions}>
                        <Show when={canManage()}>
                          <button
                            class="text-button"
                            type="button"
                            onClick={() => navigate(`/templates/${template.id}/edit`)}
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
                      {allFields().length} question{allFields().length === 1 ? "" : "s"}
                      <Show when={masterName()}>{(master) => <> · Based on {master()}</>}</Show>
                    </p>
                    <ol class={styles.templateQuestionPreview}>
                      <For each={allFields().slice(0, 3)}>{(field) => <li>{field.label}</li>}</For>
                    </ol>
                    <Show when={allFields().length > 3}>
                      <small>+{allFields().length - 3} more</small>
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
