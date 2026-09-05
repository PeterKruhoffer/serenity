import { describe, expect, it } from "vite-plus/test";
import { signWebhookPayload } from "./webhookCrypto";
import { assertPublicWebhookHostname, normalizeWebhookUrl } from "./webhookUrl";

describe("webhook signatures", () => {
  it("matches the published exact-body HMAC fixture", async () => {
    const body =
      '{"id":"evt_test_123","type":"webhook.test","api_version":"2026-09-01","created_at":"2026-09-02T10:42:17.123Z","organization_id":"org_test_123","data":{"test":{"message":"Serenity webhook endpoint test"}}}';

    await expect(signWebhookPayload("whsec_test_secret_123", 1_788_345_737, body)).resolves.toBe(
      "d059430540453432572f5f708b74899817dc162d7c26abf23dd6a59e74929a28",
    );
  });
});

describe("webhook URL validation", () => {
  it("normalizes public HTTPS URLs", () => {
    expect(normalizeWebhookUrl(" https://hooks.example.com/events#fragment ")).toBe(
      "https://hooks.example.com/events",
    );
  });

  it.each([
    "http://hooks.example.com/events",
    "https://user:password@hooks.example.com/events",
    "https://localhost/events",
    "https://127.0.0.1/events",
    "https://10.2.3.4/events",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/events",
    "https://[fd00::1]/events",
  ])("rejects unsafe endpoint %s", (url) => {
    expect(() => normalizeWebhookUrl(url)).toThrow();
  });

  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1"])(
    "rejects a private resolved address %s",
    (address) => {
      expect(() => assertPublicWebhookHostname(address)).toThrow(
        "Webhook endpoints must use a public internet host.",
      );
    },
  );
});
