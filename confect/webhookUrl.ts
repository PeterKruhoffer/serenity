const forbiddenHostnames = new Set(["localhost", "localhost.localdomain"]);

const isForbiddenIpv4 = (hostname: string) => {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
};

const isForbiddenIpv6 = (hostname: string) => {
  const normalized = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  const embeddedIpv4 = normalized.includes(".")
    ? normalized.slice(normalized.lastIndexOf(":") + 1)
    : undefined;
  return (
    (embeddedIpv4 !== undefined && isForbiddenIpv4(embeddedIpv4)) ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
};

export const assertPublicWebhookHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (
    forbiddenHostnames.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    isForbiddenIpv4(normalized) ||
    isForbiddenIpv6(normalized)
  ) {
    throw new Error("Webhook endpoints must use a public internet host.");
  }
};

export const normalizeWebhookUrl = (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid webhook URL.");
  }
  if (url.protocol !== "https:") throw new Error("Webhook endpoints must use HTTPS.");
  if (url.username || url.password) throw new Error("Webhook URLs cannot contain credentials.");
  if (!url.hostname) throw new Error("Webhook endpoints need a hostname.");
  assertPublicWebhookHostname(url.hostname);
  url.hash = "";
  return url.toString();
};
