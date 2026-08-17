import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { httpAction } from "../convex/_generated/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const errorResponse = (error: unknown) => {
  const dataMessage =
    error && typeof error === "object" && "data" in error
      ? (error.data as { message?: unknown }).message
      : undefined;
  const message =
    typeof dataMessage === "string"
      ? dataMessage
      : error instanceof Error
        ? error.message
        : "The request was rejected.";
  return jsonResponse({ error: { message } }, 400);
};

const eventIdFrom = (request: Request, suffix: string) => {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(new RegExp(`^/api/v1/events/([^/]+)/${suffix}/?$`));
  return match?.[1] as Id<"events"> | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAnswerValue = (value: unknown): value is string | boolean | string[] =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

export const getSignupForm = httpAction(async (ctx, request) => {
  const eventId = eventIdFrom(request, "signup-form");
  if (!eventId) return jsonResponse({ error: { message: "Not found." } }, 404);
  try {
    const event = await ctx.runQuery(api.attendee.getEvent, { eventId });
    return event
      ? jsonResponse({ data: event })
      : jsonResponse({ error: { message: "Not found." } }, 404);
  } catch (error) {
    return errorResponse(error);
  }
});

export const createRegistration = httpAction(async (ctx, request) => {
  const eventId = eventIdFrom(request, "registrations");
  if (!eventId) return jsonResponse({ error: { message: "Not found." } }, 404);
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("The request body must be a JSON object.");
    if (typeof body.attendeeKey !== "string" || typeof body.displayName !== "string") {
      throw new Error("attendeeKey and displayName are required.");
    }
    if (body.email !== undefined && typeof body.email !== "string") {
      throw new Error("email must be a string.");
    }
    if (body.locale !== undefined && typeof body.locale !== "string") {
      throw new Error("locale must be a string.");
    }
    if (body.answers !== undefined && !Array.isArray(body.answers)) {
      throw new Error("answers must be an array.");
    }
    const answers = (body.answers ?? []).map((answer: unknown) => {
      if (!isRecord(answer) || typeof answer.fieldId !== "string" || !isAnswerValue(answer.value)) {
        throw new Error("Each answer needs a fieldId and a valid value.");
      }
      return {
        fieldId: answer.fieldId as Id<"revision_signup_fields">,
        value: answer.value,
      };
    });
    const result = await ctx.runMutation(api.attendee.register, {
      attendeeKey: body.attendeeKey,
      eventId,
      displayName: body.displayName,
      ...(body.email === undefined ? {} : { email: body.email }),
      ...(body.locale === undefined ? {} : { locale: body.locale }),
      answers,
    });
    return jsonResponse({ data: result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

export const publicApiOptions = httpAction(
  async () => new Response(null, { status: 204, headers: corsHeaders }),
);
