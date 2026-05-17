import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  ignorePatterns: ["node_modules/**", "apps/web/src/routeTree.gen.ts"],
  jsPlugins: [
    {
      name: "@tanstack/router",
      specifier: "@tanstack/eslint-plugin-router",
    },
  ],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["typescript", "node", "react", "vitest"],
      rules: {
        "vitest/require-mock-type-parameters": "off",
      },
      env: {
        es2026: true,
        node: true,
        browser: true,
        vitest: true,
      },
    },
  ],
});
