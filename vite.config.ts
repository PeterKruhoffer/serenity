import { defineConfig } from "vite-plus";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  fmt: {
    ignorePatterns: [
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
