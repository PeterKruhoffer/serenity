// @vitest-environment jsdom

import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";
import { afterEach, describe, expect, it } from "vite-plus/test";
import App from "./App";

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

describe("Serenity authentication", () => {
  it("explains when WorkOS still needs configuration", () => {
    const host = document.createElement("div");
    document.body.append(host);
    disposers.push(render(() => <App />, host));

    expect(host.querySelector("h1")?.textContent).toBe("Connect WorkOS to continue.");
    expect(host.textContent).toContain("VITE_WORKOS_CLIENT_ID");
  });
});

describe("Workspace routing", () => {
  it("renders the application inside a route", () => {
    const host = document.createElement("div");
    document.body.append(host);
    disposers.push(
      render(
        () => (
          <Router>
            <Route path="*all" component={App} />
          </Router>
        ),
        host,
      ),
    );

    expect(host.querySelector("h1")?.textContent).toBe("Connect WorkOS to continue.");
  });
});
