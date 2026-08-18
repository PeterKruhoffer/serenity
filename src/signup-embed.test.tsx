// @vitest-environment jsdom

import { Route, Router } from "@solidjs/router";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mutate = vi.hoisted(() => vi.fn());

vi.mock("convex-solidjs", () => ({
  useMutation: () => ({ isLoading: () => false, mutate }),
  useQuery: () => ({
    data: () => ({
      id: "event-id",
      organizationName: "Open Table",
      teamName: "Community",
      title: "Autumn Supper",
      description: "A shared table.",
      timezone: "UTC",
      version: 1,
      capacity: 40,
      acceptedCount: 0,
      waitingListEnabled: true,
      registrationState: "open",
      dates: [],
      signupFields: [
        {
          id: "job-title-id",
          type: "text",
          label: "Job title",
          required: true,
          options: [],
          section: "About you",
        },
        {
          id: "dietary-id",
          type: "checkboxes",
          label: "Dietary requirements",
          required: false,
          options: ["Vegetarian", "Vegan"],
          section: "Your visit",
        },
        {
          id: "first-visit-id",
          type: "yes_no",
          label: "First visit?",
          required: true,
          options: [],
          section: "Your visit",
        },
      ],
    }),
    error: () => undefined,
    isLoading: () => false,
  }),
}));

import SignupEmbed, { createAttendeeKey } from "./SignupEmbed";

let dispose: (() => void) | undefined;

beforeEach(() => {
  window.history.replaceState({}, "", "/embed/events/event-id/signup");
  mutate.mockResolvedValue({ registrationId: "registration-id", status: "pending" });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("sign-up embed", () => {
  it("creates an opaque attendee key", () => {
    expect(createAttendeeKey()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("renders the published fields and submits typed answers", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(
      () => (
        <Router>
          <Route path="/embed/events/:eventId/signup" component={SignupEmbed} />
        </Router>
      ),
      host,
    );

    expect(host.querySelector("h1")?.textContent).toBe("Autumn Supper");
    const sectionHeadings = Array.from(host.querySelectorAll("form h2"));
    expect(sectionHeadings.map((heading) => heading.textContent)).toEqual([
      "About you",
      "Your visit",
    ]);
    const sectionHeadingClasses = sectionHeadings.map(
      (heading) => heading.parentElement!.classList,
    );
    expect(sectionHeadingClasses[0]).toHaveLength(2);
    expect(sectionHeadingClasses[1]).toHaveLength(2);
    expect(sectionHeadingClasses[0]![1]).not.toBe(sectionHeadingClasses[1]![1]);
    const textInputs = host.querySelectorAll<HTMLInputElement>(
      'input:not([type="checkbox"]):not([type="radio"])',
    );
    textInputs[0]!.value = "Alex Guest";
    textInputs[0]!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    textInputs[2]!.value = "Designer";
    textInputs[2]!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const vegetarian = Array.from(host.querySelectorAll("label"))
      .find((label) => label.textContent?.includes("Vegetarian"))
      ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    vegetarian!.checked = true;
    vegetarian!.dispatchEvent(new Event("change", { bubbles: true }));
    const no = Array.from(host.querySelectorAll("label"))
      .find((label) => label.textContent?.trim() === "No")
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    no!.checked = true;
    no!.dispatchEvent(new Event("change", { bubbles: true }));
    host
      .querySelector("form")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-id",
        displayName: "Alex Guest",
        attendeeKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        answers: [
          { fieldId: "job-title-id", value: "Designer" },
          { fieldId: "dietary-id", value: ["Vegetarian"] },
          { fieldId: "first-visit-id", value: false },
        ],
      }),
    );
    await vi.waitFor(() => expect(host.textContent).toContain("You’re registered"));
  });
});
