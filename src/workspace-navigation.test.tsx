// @vitest-environment jsdom

import { getFunctionName, type FunctionReference } from "convex/server";
import { Router } from "@solidjs/router";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const convex = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  error: () => null,
  isAuthenticated: () => true,
  isConfigured: () => true,
  isLoading: () => false,
  isWorkspaceAuthenticated: () => true,
  signIn: vi.fn(),
  signOut: vi.fn(),
  user: () => ({ email: "admin@example.com", firstName: "Ada", lastName: "Admin" }),
}));

vi.mock("convex-solidjs", () => convex);
vi.mock("./auth", () => ({ useWorkOSAuth: () => auth }));

import { SerenityRoutes } from "./routes";

const disposers: Array<() => void> = [];

const queryResult = (data: unknown) => ({
  data: () => data,
  error: () => undefined,
  isLoading: () => false,
  refetch: vi.fn(),
});

beforeEach(() => {
  window.scrollTo = vi.fn();
  convex.useMutation.mockReturnValue({ isLoading: () => false, mutate: vi.fn() });
  convex.useQuery.mockImplementation((reference: FunctionReference<"query">) => {
    switch (getFunctionName(reference)) {
      case "workspace:list":
        return queryResult({
          viewer: { displayName: "Ada Admin" },
          organizations: [
            {
              id: "organization-id",
              name: "Serenity Test",
              role: "administrator",
              teams: [{ id: "team-id", name: "Events team" }],
            },
          ],
        });
      case "events:list":
      case "publication:listPending":
      case "registrations:list":
        return queryResult([]);
      case "events:get":
        return queryResult(undefined);
      default:
        throw new Error(`Unexpected query: ${getFunctionName(reference)}`);
    }
  });
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("signed-in workspace navigation", () => {
  it("keeps focus in schedule fields while typing", () => {
    window.history.replaceState({}, "", "/events");
    const host = document.createElement("div");
    document.body.append(host);
    disposers.push(
      render(
        () => (
          <Router>
            <SerenityRoutes />
          </Router>
        ),
        host,
      ),
    );

    const newEventButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("New event"),
    );
    newEventButton?.click();
    const venue = host.querySelector<HTMLInputElement>('input[placeholder="Harbor House"]');
    expect(venue).toBeTruthy();

    venue?.focus();
    for (const value of ["T", "Th", "Tha", "That"]) {
      if (!venue) break;
      venue.value = value;
      venue.dispatchEvent(new InputEvent("input", { bubbles: true, data: value.at(-1) }));
      expect(host.querySelector('input[placeholder="Harbor House"]')).toBe(venue);
      expect(document.activeElement).toBe(venue);
    }
  });

  it("renders each page when its sidebar link is clicked", async () => {
    window.history.replaceState({}, "", "/events");
    const host = document.createElement("div");
    document.body.append(host);
    disposers.push(
      render(
        () => (
          <Router>
            <SerenityRoutes />
          </Router>
        ),
        host,
      ),
    );

    expect(host.querySelector("h1")?.textContent).toContain("Ada");

    for (const [linkName, pathname, heading] of [
      ["Approvals", "/approvals", "Approvals"],
      ["Participants", "/participants", "Participants"],
      ["Settings", "/settings", "Settings"],
      ["Events", "/events", "Ada"],
    ] as const) {
      const link = Array.from(host.querySelectorAll("a")).find((candidate) =>
        candidate.textContent?.trim().endsWith(linkName),
      );
      expect(link).toBeTruthy();
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(window.location.pathname).toBe(pathname);
        expect(host.querySelector("h1")?.textContent).toContain(heading);
      });
      const activeLink = Array.from(host.querySelectorAll("a")).find((candidate) =>
        candidate.textContent?.trim().endsWith(linkName),
      );
      expect(activeLink?.getAttribute("aria-current")).toBe("page");
    }
  });
});
