import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

loadDotenv({ path: ".env.test", quiet: true });

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    pool: "forks",
  },
});
