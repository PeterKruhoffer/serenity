import { env } from "../convex/_generated/server";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const additionalData = encoder.encode("serenity-webhook-secret-v1");

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const fromBase64 = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const encryptionKey = async () => {
  const encoded = env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("WEBHOOK_SECRET_ENCRYPTION_KEY is not configured.");
  }
  const bytes = fromBase64(encoded);
  if (bytes.byteLength !== 32) {
    throw new Error("WEBHOOK_SECRET_ENCRYPTION_KEY must encode exactly 32 bytes.");
  }
  return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const createSigningSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `whsec_${toBase64Url(bytes)}`;
};

export const encryptSigningSecret = async (secret: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await encryptionKey(),
    encoder.encode(secret),
  );
  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
  };
};

export const decryptSigningSecret = async (ciphertext: string, iv: string) => {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv), additionalData },
    await encryptionKey(),
    fromBase64(ciphertext),
  );
  return decoder.decode(plaintext);
};

export const signWebhookPayload = async (secret: string, timestamp: number, body: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};
