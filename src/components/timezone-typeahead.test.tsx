// @vitest-environment jsdom

import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TimezoneTypeahead } from "./timezone-typeahead";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

describe("TimezoneTypeahead", () => {
  it("treats a selected required timezone as valid form input", () => {
    const form = document.createElement("form");
    document.body.append(form);
    dispose = render(
      () => (
        <TimezoneTypeahead value="Europe/Copenhagen" name="timezone" onChange={vi.fn()} required />
      ),
      form,
    );

    expect(form.querySelector<HTMLInputElement>('[role="combobox"]')?.required).toBe(true);
    expect(form.checkValidity()).toBe(true);
  });

  it("finds and selects a timezone by abbreviation", () => {
    const onChange = vi.fn();
    const [value, setValue] = createSignal("UTC");
    const host = document.createElement("div");
    document.body.append(host);
    dispose = render(
      () => (
        <TimezoneTypeahead
          value={value()}
          name="timezone"
          onChange={(timezone) => {
            setValue(timezone);
            onChange(timezone);
          }}
          required
        />
      ),
      host,
    );

    const input = host.querySelector<HTMLInputElement>('[role="combobox"]')!;
    input.focus();
    input.value = "cet";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));

    const paris = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (option) => option.textContent?.includes("Europe/Paris"),
    )!;
    expect(paris.textContent).toContain("CET");

    paris.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith("Europe/Paris");
    expect(input.value).toBe("Europe/Paris");
    expect(input.getAttribute("aria-expanded")).toBe("false");

    input.value = "pst";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    const activeOption = document.getElementById(input.getAttribute("aria-activedescendant")!)!;
    const activeTimezone = activeOption.querySelector("span")!.textContent!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith(activeTimezone);
    expect(input.value).toBe(activeTimezone);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector<HTMLSelectElement>('select[name="timezone"]')?.value).toBe(
      activeTimezone,
    );
  });
});
