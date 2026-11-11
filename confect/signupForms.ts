import type { GenericId } from "convex/values";
import * as Effect from "effect/Effect";
import { DatabaseReader } from "./_generated/services";

// The limit applies separately to a template (including its master's fields) and to an
// event's own fields, so a published form holds at most twice this many fields.
export const MAX_SIGNUP_FIELDS = 50;
export const MAX_FORM_FIELDS = MAX_SIGNUP_FIELDS * 2;

type StoredSignupField = {
  readonly type: "text" | "textarea" | "yes_no" | "checkboxes";
  readonly label: string;
  readonly required: boolean;
  readonly options: ReadonlyArray<string>;
  readonly section?: string;
};

export const toSignupField = (field: StoredSignupField) => ({
  type: field.type,
  label: field.label,
  required: field.required,
  options: field.options,
  ...(field.section === undefined ? {} : { section: field.section }),
});

const ownTemplateFields = (templateId: GenericId<"signup_form_templates">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("signup_form_fields")
      .index("by_templateId_and_sortOrder", (q) => q.eq("templateId", templateId))
      .take(MAX_SIGNUP_FIELDS);
  });

/** A template with its effective fields: its master template's fields, then its own. */
export const resolveTemplate = (templateId: GenericId<"signup_form_templates">) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const template = yield* reader
      .table("signup_form_templates")
      .get(templateId)
      .pipe(Effect.orDie);
    const inherited =
      template.parentTemplateId === undefined
        ? []
        : yield* ownTemplateFields(template.parentTemplateId);
    const own = yield* ownTemplateFields(templateId);
    return { template, inherited, own, fields: [...inherited, ...own] };
  });

/** The event's complete sign-up form: linked template fields, then the event's own fields. */
export const resolveEventForm = (event: {
  readonly _id: GenericId<"events">;
  readonly signupTemplateId?: GenericId<"signup_form_templates">;
}) =>
  Effect.gen(function* () {
    const reader = yield* DatabaseReader;
    const templateFields =
      event.signupTemplateId === undefined
        ? []
        : (yield* resolveTemplate(event.signupTemplateId)).fields;
    const own = yield* reader
      .table("signup_form_fields")
      .index("by_eventId_and_sortOrder", (q) => q.eq("eventId", event._id))
      .take(MAX_SIGNUP_FIELDS);
    return [...templateFields, ...own];
  });
