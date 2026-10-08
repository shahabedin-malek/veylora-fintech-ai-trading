import { defineConfig } from "@playwright/test";

const PORT = 3210;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 300_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    // Use the system Chrome so no browser download is required.
    channel: "chrome",
    headless: true,
    baseURL: `http://127.0.0.1:${PORT}`,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
