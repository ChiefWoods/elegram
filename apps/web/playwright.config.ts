import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4173";
const serverURL = process.env.PLAYWRIGHT_SERVER_URL ?? "http://localhost:3000";
const serverReadyURL = new URL("/health", serverURL).toString();
const CI = process.env.CI === "true";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: [
    {
      command: "NODE_ENV=test bun run dev",
      cwd: "../server",
      url: serverReadyURL,
      reuseExistingServer: !CI,
      timeout: 15_000,
      stdout: "pipe",
      stderr: "pipe",
      name: "backend",
    },
    {
      command: "bunx vite --host localhost --port 4173 --mode test",
      cwd: ".",
      url: baseURL,
      reuseExistingServer: !CI,
      timeout: 15_000,
      stdout: "pipe",
      stderr: "pipe",
      name: "frontend",
    },
  ],
});
