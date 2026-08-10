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

import { WorkOSAuthProvider } from "./auth";

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("WorkOS navigation", () => {
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
