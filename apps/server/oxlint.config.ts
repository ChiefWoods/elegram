import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  ignorePatterns: ["generated/**", "node_modules/**"],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["typescript", "node"],
      env: {
        es2026: true,
        node: true,
      },
    },
  ],
});
