export type Theme = "ritual" | "nocturne";

const defaultTheme: Theme = "ritual";
const storageKey = "serenity-theme";

export function readTheme(): Theme {
  if (typeof window === "undefined") return defaultTheme;

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    return storedTheme === "nocturne" || storedTheme === "ritual" ? storedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

export function applyTheme(theme: Theme, persist = true) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }

  if (!persist || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // The selected theme still applies when browser storage is unavailable.
  }
}
