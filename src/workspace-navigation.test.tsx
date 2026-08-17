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
      case "events:listSignupTemplates":
        return queryResult([
          {
            id: "template-id",
            name: "Standard attendee questions",
            scope: "organization",
            fields: [
              {
                type: "text",
                label: "Job title",
                required: true,
                options: [],
              },
            ],
          },
        ]);
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
  it("builds and reorders custom sign-up fields", async () => {
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

    await vi.waitFor(() => expect(host.textContent).toContain("New event"));
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("New event"))
      ?.click();
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "＋ Short answer")
      ?.click();
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "＋ Checkboxes")
      ?.click();

    const questions = host.querySelectorAll<HTMLInputElement>(
      'input[placeholder="What would you like us to know?"]',
    );
    expect(questions).toHaveLength(2);
    questions[0]!.value = "Job title";
    questions[0]!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    questions[1]!.value = "Dietary requirements";
    questions[1]!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(host.querySelector('input[placeholder="Choice 1"]')).toBeTruthy();

    host.querySelector<HTMLButtonElement>('[aria-label="Move Dietary requirements up"]')?.click();
    const reorderedQuestions = host.querySelectorAll<HTMLInputElement>(
      'input[placeholder="What would you like us to know?"]',
    );
    expect(reorderedQuestions[0]?.value).toBe("Dietary requirements");
    expect(reorderedQuestions[1]?.value).toBe("Job title");
  });

  it("keeps focus in schedule fields while typing", async () => {
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

    await vi.waitFor(() => expect(host.textContent).toContain("New event"));
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

  it("renders sign-up form management on the templates route", async () => {
    window.history.replaceState({}, "", "/templates");
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

    await vi.waitFor(() => expect(host.querySelector("h1")?.textContent).toBe("Templates"));
    expect(host.textContent).toContain("Standard attendee questions");
    expect(host.textContent).toContain("Organization");
    expect(
      Array.from(host.querySelectorAll("button")).some((button) => button.textContent === "Edit"),
    ).toBe(true);
    expect(
      Array.from(host.querySelectorAll("button")).some((button) => button.textContent === "Delete"),
    ).toBe(true);

    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Edit")
      ?.click();
    expect(
      host.querySelector<HTMLInputElement>('input[placeholder="Standard attendee questions"]')
        ?.value,
    ).toBe("Standard attendee questions");
    expect(
      host.querySelector<HTMLInputElement>('input[placeholder="What would you like us to know?"]')
        ?.value,
    ).toBe("Job title");
    expect(host.textContent).toContain("Save changes");

    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "Close ＋")
      ?.click();
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "New template ＋")
      ?.click();
    expect(host.textContent).toContain("Build a sign-up form");
    expect(host.textContent).toContain("Entire organization");
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "＋ Short answer")
      ?.click();
    expect(
      host.querySelectorAll('input[placeholder="What would you like us to know?"]'),
    ).toHaveLength(1);
    expect(host.textContent).toContain("Create template");
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

    await vi.waitFor(() => expect(host.querySelector("h1")?.textContent).toContain("Ada"));

    for (const [linkName, pathname, heading] of [
      ["Templates", "/templates", "Templates"],
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
