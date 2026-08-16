import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@convex-dev/workos-authkit", () => ({
  AuthKit: class {
    registerRoutes() {}
  },
}));

import http from "./http";

describe("public sign-up HTTP routes", () => {
  it.each(["GET", "POST", "OPTIONS"] as const)("registers the %s endpoint", (method) => {
    expect(http.lookup("/api/v1/events/event-id/signup-form", method)).not.toBeNull();
  });
});
