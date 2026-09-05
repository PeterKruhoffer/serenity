// @vitest-environment jsdom

import { getFunctionName, type FunctionReference } from "convex/server";
import { Router } from "@solidjs/router";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const convex = vi.hoisted(() => ({
  useAction: vi.fn(),
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
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  convex.useAction.mockReturnValue({ isLoading: () => false, mutate: vi.fn() });
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
              defaultTimezone: "Europe/Copenhagen",
              role: "administrator",
              teams: [{ id: "team-id", name: "Events team" }],
            },
          ],
        });
      case "events:list":
        return queryResult([
          {
            id: "event-id",
            title: "Leadership essentials",
            description: "A focused leadership program",
            topicId: "leadership-topic-id",
            topicName: "Leadership",
            status: "draft",
            teamId: "team-id",
            teamName: "Events team",
            occurrenceCount: 1,
            sessionCount: 2,
          },
        ]);
      case "publication:listPending":
      case "registrations:list":
      case "webhooks:listEndpoints":
      case "webhooks:listDeliveries":
        return queryResult([]);
      case "events:listCalendarOccurrences":
        return queryResult([
          {
            id: "occurrence-id",
            eventId: "event-id",
            eventTitle: "Leadership essentials",
            eventStatus: "draft",
            eventTimezone: "Europe/Copenhagen",
            teamId: "team-id",
            teamName: "Events team",
            startsAt: Date.UTC(2026, 7, 19, 7),
            endsAt: Date.UTC(2026, 7, 19, 15),
            occurrenceStatus: "cancelled",
            venueName: "Harbor House",
          },
        ]);
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
      case "events:listTopics":
        return queryResult({
          topics: [
            { id: "leadership-topic-id", name: "Leadership" },
            { id: "law-topic-id", name: "Law" },
          ],
        });
      case "events:get":
        return queryResult({
          event: {
            id: "event-id",
            title: "Leadership essentials",
            description: "A focused leadership program",
            topicId: "leadership-topic-id",
            topicName: "Leadership",
            status: "draft",
            teamId: "team-id",
            teamName: "Events team",
            timezone: "Europe/Copenhagen",
          },
          dates: [],
        });
      default:
        throw new Error(`Unexpected query: ${getFunctionName(reference)}`);
    }
  });
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("signed-in workspace navigation", () => {
  it("applies and remembers the selected appearance", async () => {
    window.history.replaceState({}, "", "/settings");
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

    await vi.waitFor(() => expect(host.querySelector("h1")?.textContent).toBe("Settings"));
    const nocturne = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Nocturne"),
    );
    expect(nocturne?.getAttribute("aria-pressed")).toBe("false");

    nocturne?.click();

    expect(document.documentElement.dataset.theme).toBe("nocturne");
    expect(window.localStorage.getItem("serenity-theme")).toBe("nocturne");
    expect(nocturne?.getAttribute("aria-pressed")).toBe("true");

    expect(host.querySelector('input[placeholder="New topic"]')).toBeTruthy();
    expect(host.textContent).toContain("Leadership");
    expect(host.textContent).toContain("Law");
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Rename")
      ?.click();
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Topic name"]')?.value).toBe(
      "Leadership",
    );
  });

  it("uses the organization topic picker when editing a draft event", async () => {
    window.history.replaceState({}, "", "/events/event-id");
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

    await vi.waitFor(() => expect(host.textContent).toContain("Save topic"));
    const topicPicker = Array.from(host.querySelectorAll("label")).find(
      (label) => label.querySelector(":scope > span")?.textContent === "Topic",
    );
    const select = topicPicker?.querySelector<HTMLSelectElement>("select");
    expect(select?.value).toBe("leadership-topic-id");
    expect(Array.from(select?.options ?? []).map((option) => option.text)).toContain("Law");
    expect(topicPicker?.querySelector("input")).toBeNull();
  });

  it("shows the administrator webhook endpoint form", async () => {
    window.history.replaceState({}, "", "/settings");
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

    await vi.waitFor(() => expect(host.textContent).toContain("Webhooks"));
    const addEndpoint = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add endpoint",
    );
    addEndpoint?.click();

    expect(host.querySelector('input[type="url"]')).toBeTruthy();
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(6);
    expect(host.textContent).toContain("Create disabled endpoint");
  });

  it("opens the global command palette and routes actions without creating anything", async () => {
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

    await vi.waitFor(() => expect(host.textContent).toContain("Search"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));

    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]');
    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(document.body.textContent).toContain("Create event");
    expect(document.body.textContent).toContain("Leadership essentials");
    expect(document.body.textContent).toContain("Events team");
    expect(document.body.textContent).toContain("Standard attendee questions");

    input!.value = "create event";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('[role="option"]')).map((option) =>
          option.textContent?.trim(),
        ),
      ).toEqual(["＋Create eventOpen the full event builder↵"]),
    );
    document.querySelector<HTMLElement>('[role="option"]')?.click();

    await vi.waitFor(() => expect(window.location.pathname).toBe("/events/new"));
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    await vi.waitFor(() => expect(host.textContent).toContain("Create an event"));
    const topicPicker = Array.from(host.querySelectorAll("label")).find(
      (label) => label.querySelector(":scope > span")?.textContent === "Topic",
    );
    expect(topicPicker?.querySelector("select[required]")).toBeTruthy();
    expect(topicPicker?.querySelector("input")).toBeNull();
    expect(topicPicker?.textContent).toContain("Leadership");
    expect(topicPicker?.textContent).toContain("Law");
  });

  it("supports palette accelerators and global key sequences without intercepting typing", async () => {
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

    await vi.waitFor(() => expect(host.textContent).toContain("Search"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());

    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    input.value = "calendar";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" }));
    expect(document.body.textContent).toContain("Alt+1");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", code: "Digit1", altKey: true }));
    await vi.waitFor(() => expect(window.location.pathname).toBe("/calendar"));

    const pageInput = document.createElement("input");
    document.body.append(pageInput);
    pageInput.focus();
    pageInput.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
    pageInput.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    expect(window.location.pathname).toBe("/calendar");

    pageInput.blur();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "g" }));
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Events");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    await vi.waitFor(() => expect(window.location.pathname).toBe("/events"));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    await vi.waitFor(() => expect(document.body.textContent).toContain("Keyboard shortcuts"));
    expect(document.body.textContent).toContain("g p");
    expect(document.body.textContent).toContain("c e");
  });

  it("builds sections and drag-reorders custom sign-up fields", async () => {
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
    await vi.waitFor(() => expect(window.location.pathname).toBe("/events/new"));
    await vi.waitFor(() => expect(host.textContent).toContain("Build the event"));
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

    const dragHandle = host.querySelector<HTMLButtonElement>(
      '[aria-label="Drag Dietary requirements"]',
    );
    const firstCard = questions[0]!.closest<HTMLElement>("section");
    expect(dragHandle).toBeTruthy();
    expect(firstCard).toBeTruthy();
    firstCard!.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect;
    const dataTransfer = {
      effectAllowed: "none",
      setData: vi.fn(),
      getData: vi.fn(() => ""),
    };
    for (const [target, type, clientY] of [
      [dragHandle, "dragstart", 0],
      [firstCard, "dragover", 10],
      [firstCard, "drop", 10],
    ] as const) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientY: { value: clientY },
        dataTransfer: { value: dataTransfer },
      });
      target!.dispatchEvent(event);
    }
    const reorderedQuestions = host.querySelectorAll<HTMLInputElement>(
      'input[placeholder="What would you like us to know?"]',
    );
    expect(reorderedQuestions[0]?.value).toBe("Dietary requirements");
    expect(reorderedQuestions[1]?.value).toBe("Job title");

    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "＋ Section")
      ?.click();
    const sectionTitle = host.querySelector<HTMLInputElement>('input[placeholder="About you"]');
    expect(sectionTitle).toBeTruthy();
    sectionTitle!.value = "Your preferences";
    sectionTitle!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(sectionTitle!.value).toBe("Your preferences");
    const sectionDivider = host
      .querySelector('[aria-label="Drag Your preferences"]')
      ?.closest("div");
    expect(sectionDivider).toBeTruthy();
    expect(sectionDivider!.classList).toHaveLength(2);
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
    await vi.waitFor(() => expect(window.location.pathname).toBe("/events/new"));
    await vi.waitFor(() =>
      expect(host.querySelector('input[placeholder="Harbor House"]')).toBeTruthy(),
    );
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
    await vi.waitFor(() => expect(window.location.pathname).toBe("/templates/template-id/edit"));
    await vi.waitFor(() =>
      expect(
        host.querySelector<HTMLInputElement>('input[placeholder="Standard attendee questions"]'),
      ).toBeTruthy(),
    );
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
    await vi.waitFor(() => expect(window.location.pathname).toBe("/templates"));
    await vi.waitFor(() => expect(host.textContent).toContain("New template"));
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "New template ＋")
      ?.click();
    await vi.waitFor(() => expect(window.location.pathname).toBe("/templates/new"));
    await vi.waitFor(() => expect(host.textContent).toContain("Build a sign-up form"));
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

  it("keeps calendar view, date, and team filters in the URL", async () => {
    window.history.replaceState({}, "", "/calendar?view=month&date=2026-08-19");
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

    await vi.waitFor(() => expect(host.querySelector("h1")?.textContent).toBe("Calendar"));
    expect(host.textContent).toContain("August 2026");
    expect(host.textContent).toContain("Leadership essentials");
    expect(host.textContent).toContain("Events team · Draft · Cancelled");

    host
      .querySelector<HTMLButtonElement>('[data-corvu-popover-trigger][class*="eventChip"]')
      ?.click();
    await vi.waitFor(() => expect(host.textContent).toContain("Harbor House"));
    expect(host.textContent).toContain("Europe/Copenhagen");
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Close")
      ?.click();

    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === "Jump to date")
      ?.click();
    await vi.waitFor(() => expect(host.querySelector("[data-corvu-calendar-table]")).toBeTruthy());

    const teamFilter = host.querySelector<HTMLSelectElement>('select[aria-label="Filter by team"]');
    expect(teamFilter).toBeTruthy();
    teamFilter!.value = "team-id";
    teamFilter!.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() =>
      expect(new URLSearchParams(window.location.search).get("team")).toBe("team-id"),
    );

    host.querySelector<HTMLButtonElement>('button[aria-label="Previous month"]')?.click();
    await vi.waitFor(() =>
      expect(new URLSearchParams(window.location.search).get("date")).toBe("2026-07-01"),
    );
  });

  it("defaults the calendar to month view", async () => {
    window.history.replaceState({}, "", "/calendar");
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

    await vi.waitFor(() => expect(host.querySelector("h1")?.textContent).toBe("Calendar"));
    const monthButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Month",
    );
    expect(monthButton?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('button[aria-label="Previous month"]')).toBeTruthy();
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
      ["Calendar", "/calendar", "Calendar"],
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
