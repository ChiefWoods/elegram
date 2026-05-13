import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  ignorePatterns: ["node_modules/**"],
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
