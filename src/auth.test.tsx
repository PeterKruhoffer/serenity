// @vitest-environment jsdom

import type { ConvexClient } from "convex/browser";
import { Route, Router, useLocation, type RouteSectionProps } from "@solidjs/router";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const authKit = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@workos-inc/authkit-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workos-inc/authkit-js")>()),
  createClient: authKit.createClient,
}));

import {
  WorkOSAuthProvider,
  topLevelSignInUrl,
  usesWorkOSDevelopmentStorage,
  workOSRedirectUri,
} from "./auth";

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("WorkOS navigation", () => {
  it("uses the active portal origin for the authentication callback", () => {
    expect(
      workOSRedirectUri(
        "http://localhost:5173/callback",
        "https://example-thread-p30836.onamp.dev",
      ),
    ).toBe("https://example-thread-p30836.onamp.dev/callback");
    expect(workOSRedirectUri("http://localhost:5173/callback", "http://localhost:5173")).toBe(
      "http://localhost:5173/callback",
    );
  });

  it("creates a top-level sign-in URL without discarding the current route", () => {
    expect(
      topLevelSignInUrl({ href: "https://example-thread-p30836.onamp.dev/events?view=upcoming" }),
    ).toBe("https://example-thread-p30836.onamp.dev/events?view=upcoming&workos-sign-in=true");
  });

  it("uses client-side session storage without a same-site authentication API domain", () => {
    expect(usesWorkOSDevelopmentStorage("example-thread-p30836.onamp.dev")).toBe(true);
    expect(usesWorkOSDevelopmentStorage("app.example.com")).toBe(true);
    expect(usesWorkOSDevelopmentStorage("app.example.com", "auth.example.com")).toBe(false);
    expect(
      usesWorkOSDevelopmentStorage("example-thread-p30836.onamp.dev", "auth.example.com"),
    ).toBe(true);
  });

  it("keeps the router location in sync after an authentication redirect", async () => {
    let finishRedirect: (() => void) | undefined;
    authKit.createClient.mockImplementation(
      async (_clientId: string, options: { onRedirectCallback: () => void }) => {
        finishRedirect = options.onRedirectCallback;
        return {
          dispose: vi.fn(),
          getAccessToken: vi.fn(),
          getUser: vi.fn(() => null),
          signIn: vi.fn(),
          signOut: vi.fn(),
        };
      },
    );

    const client = { setAuth: vi.fn() } as unknown as ConvexClient;
    const LocationProbe = () => {
      const location = useLocation();
      return <p data-testid="pathname">{location.pathname}</p>;
    };
    const AuthenticatedRoot = (props: RouteSectionProps) => (
      <WorkOSAuthProvider client={client}>{props.children}</WorkOSAuthProvider>
    );

    window.history.replaceState({}, "", "/callback?code=example");
    const host = document.createElement("div");
    document.body.append(host);
    disposers.push(
      render(
        () => (
          <Router root={AuthenticatedRoot}>
            <Route path="*all" component={LocationProbe} />
          </Router>
        ),
        host,
      ),
    );

    await vi.waitFor(() => expect(finishRedirect).toBeTypeOf("function"));
    expect(host.querySelector('[data-testid="pathname"]')?.textContent).toBe("/callback");

    finishRedirect?.();

    await vi.waitFor(() =>
      expect(host.querySelector('[data-testid="pathname"]')?.textContent).toBe("/"),
    );
    expect(window.location.pathname).toBe("/");
  });
});
