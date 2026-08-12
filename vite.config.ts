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
