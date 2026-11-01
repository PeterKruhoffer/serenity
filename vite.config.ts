import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    allowedHosts: [".onamp.dev", ".e2b.app"],
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "convex/**/*.test.ts",
      "confect/**/*.test.ts",
    ],
    environment: "edge-runtime",
    // Node's built-in Web Storage (on by default since Node 25) shadows
    // jsdom's localStorage in test workers.
    execArgv: process.allowedNodeEnvironmentFlags.has("--no-experimental-webstorage")
      ? ["--no-experimental-webstorage"]
      : [],
  },
  fmt: {
    ignorePatterns: [
      "AGENTS.md",
      "confect/_generated/**",
      "convex/_generated/**",
      "convex/README.md",
      "pnpm-workspace.yaml",
    ],
  },
  lint: {
    ignorePatterns: ["confect/_generated/**", "convex/_generated/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
