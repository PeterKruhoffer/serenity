// @vitest-environment jsdom

import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vite-plus/test";
import App from "./App";

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

describe("Serenity starter", () => {
  it("renders the clean starting point", () => {
    const host = document.createElement("div");
    document.body.append(host);
    disposers.push(render(() => <App />, host));

    expect(host.querySelector("h1")?.textContent).toBe("Start with what matters.");
    expect(host.textContent).toContain("Serenity is ready");
  });
});
