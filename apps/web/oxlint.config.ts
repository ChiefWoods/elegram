import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  ignorePatterns: [
    ".tanstack/**",
    ".turbo/**",
    "dist/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "src/routeTree.gen.ts",
  ],
  jsPlugins: [
    {
      name: "@tanstack/router",
      specifier: "@tanstack/eslint-plugin-router",
    },
    {
      name: "@tanstack/query",
      specifier: "@tanstack/eslint-plugin-query",
    },
  ],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["typescript", "react", "vitest"],
      rules: {
        "vitest/require-mock-type-parameters": "off",
      },
      env: {
        es2026: true,
        browser: true,
        vitest: true,
      },
    },
  ],
});
