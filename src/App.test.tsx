// @vitest-environment jsdom

import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vite-plus/test";
import App from "./App";

const disposers: Array<() => void> = [];

const renderRoute = (path: string) => {
  window.history.replaceState({}, "", path);
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = render(() => <App />, host);
  disposers.push(dispose);

  return host;
};

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

describe("Hemaguard routing", () => {
  it("renders the command center at the root route", () => {
    const host = renderRoute("/");

    expect(host.querySelector("h1")?.textContent).toBe("Blood supply command center");
    expect(host.textContent).toContain("Crimson Jackal");
  });

  it("renders a routed supply-network view", () => {
    const host = renderRoute("/network");

    expect(host.querySelector("h1")?.textContent).toBe("Supply network");
    expect(host.textContent).toContain("436 monitored facilities");
  });
});
