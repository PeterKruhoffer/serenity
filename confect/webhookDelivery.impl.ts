"use node";

import { FunctionImpl, GroupImpl } from "@confect/server";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import refs from "./_generated/refs";
import { MutationRunner } from "./_generated/services";
import webhookDelivery from "./webhookDelivery.spec";
import { decryptSigningSecret, signWebhookPayload } from "./webhookCrypto";
import { assertPublicWebhookHostname, normalizeWebhookUrl } from "./webhookUrl";

const LEASE_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [
  0,
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  8 * 60 * 60_000,
  24 * 60 * 60_000,
  48 * 60 * 60_000,
];

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString("base64url");
};

const resolvePublicDestination = async (rawUrl: string) => {
  const url = new URL(normalizeWebhookUrl(rawUrl));
  const servername = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  const addresses = await lookup(servername, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("Webhook endpoint did not resolve to an address.");
  for (const { address } of addresses) assertPublicWebhookHostname(address);
  return { url, address: { ...addresses[0]!, servername } };
};

type WebhookResponse = {
  status: number;
  retryAfter?: string;
  excerpt?: string;
};

const postWebhook = (
  url: URL,
  resolved: { address: string; family: number; servername: string },
  body: string,
  headers: Record<string, string>,
) =>
  new Promise<WebhookResponse>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const fail = (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    };
    const outgoing = request(
      url,
      {
        method: "POST",
        headers,
        servername: resolved.servername,
        lookup: (_hostname, _options, callback) =>
          callback(null, resolved.address, resolved.family),
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        let length = 0;
        incoming.on("data", (chunk: Buffer) => {
          if (length >= 2_048) return;
          const remaining = 2_048 - length;
          const part = chunk.subarray(0, remaining);
          chunks.push(part);
          length += part.length;
        });
        incoming.on("end", () => {
          const excerpt = Buffer.concat(chunks)
            .toString("utf8")
            .split("")
            .filter((character) => {
              const code = character.charCodeAt(0);
              return code > 31 || code === 9 || code === 10 || code === 13;
            })
            .join("");
          const retryAfter = incoming.headers["retry-after"];
          clearTimeout(timeout);
          resolve({
            status: incoming.statusCode ?? 0,
            ...(typeof retryAfter === "string" ? { retryAfter } : {}),
            ...(excerpt ? { excerpt } : {}),
          });
        });
        incoming.on("error", fail);
      },
    );
    timeout = setTimeout(
      () => outgoing.destroy(new Error("Webhook request timed out.")),
      REQUEST_TIMEOUT_MS,
    );
    outgoing.on("error", fail);
    outgoing.end(body);
  });

const retryAfterMs = (response: WebhookResponse, attemptNumber: number) => {
  const fallback = RETRY_DELAYS_MS[Math.min(attemptNumber, RETRY_DELAYS_MS.length - 1)] ?? 60_000;
  const header = response.retryAfter;
  if (!header) return fallback;
  const seconds = Number(header);
  const requested = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - Date.now();
  return Math.min(48 * 60 * 60_000, Math.max(fallback, requested || 0));
};

const withJitter = (delay: number) => Math.round(delay * (0.85 + Math.random() * 0.3));

const safeError = (error: unknown) =>
  error instanceof Error ? error.message.slice(0, 500) : "Webhook request failed.";

const deliver = FunctionImpl.make(databaseSchema, webhookDelivery, "deliver", ({ deliveryId }) =>
  Effect.gen(function* () {
    const runner = yield* MutationRunner;
    const leaseToken = randomToken();
    const startedAt = Date.now();
    const prepared = yield* runner(refs.internal.webhooks.prepareDelivery, {
      deliveryId,
      leaseToken,
      now: startedAt,
      leaseExpiresAt: startedAt + LEASE_MS,
    }).pipe(Effect.orDie);
    if (!prepared.ready) return null;

    const outcome = yield* Effect.promise(async () => {
      try {
        const destination = await resolvePublicDestination(prepared.endpointUrl);
        const data: unknown = JSON.parse(prepared.data);
        const body = JSON.stringify({
          id: prepared.eventId,
          type: prepared.eventType,
          api_version: prepared.apiVersion,
          created_at: new Date(prepared.occurredAt).toISOString(),
          organization_id: prepared.organizationId,
          data,
        });
        const timestamp = Math.floor(Date.now() / 1_000);
        const currentSecret = await decryptSigningSecret(
          prepared.secretCiphertext,
          prepared.secretIv,
        );
        const signatures = [await signWebhookPayload(currentSecret, timestamp, body)];
        if (prepared.previousSecretCiphertext && prepared.previousSecretIv) {
          const previousSecret = await decryptSigningSecret(
            prepared.previousSecretCiphertext,
            prepared.previousSecretIv,
          );
          signatures.push(await signWebhookPayload(previousSecret, timestamp, body));
        }
        const response = await postWebhook(destination.url, destination.address, body, {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body)),
          "User-Agent": "Serenity-Webhooks/1.0",
          "Serenity-Event-Id": prepared.eventId,
          "Serenity-Event-Type": prepared.eventType,
          "Serenity-Signature": `t=${timestamp},${signatures.map((signature) => `v1=${signature}`).join(",")}`,
        });
        if (response.status >= 200 && response.status < 300) {
          return {
            result: "delivered" as const,
            responseStatus: response.status,
            excerpt: response.excerpt,
          };
        }
        if (
          response.status === 408 ||
          response.status === 409 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          return {
            result: "retry" as const,
            responseStatus: response.status,
            excerpt: response.excerpt,
            retryDelay: withJitter(retryAfterMs(response, prepared.attemptNumber)),
          };
        }
        return {
          result: "failed" as const,
          responseStatus: response.status,
          excerpt: response.excerpt,
        };
      } catch (error) {
        const delay =
          RETRY_DELAYS_MS[Math.min(prepared.attemptNumber, RETRY_DELAYS_MS.length - 1)] ?? 60_000;
        return {
          result: "retry" as const,
          excerpt: safeError(error),
          retryDelay: withJitter(delay),
        };
      }
    });

    yield* runner(refs.internal.webhooks.completeDelivery, {
      deliveryId,
      leaseToken,
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      result: outcome.result,
      ...(outcome.responseStatus === undefined ? {} : { responseStatus: outcome.responseStatus }),
      ...(outcome.excerpt ? { excerpt: outcome.excerpt } : {}),
      ...(outcome.retryDelay === undefined ? {} : { retryDelayMs: outcome.retryDelay }),
    }).pipe(Effect.orDie);
    return null;
  }),
);

export default GroupImpl.make(databaseSchema, webhookDelivery).pipe(
  Layer.provide(deliver),
  GroupImpl.finalize,
);
