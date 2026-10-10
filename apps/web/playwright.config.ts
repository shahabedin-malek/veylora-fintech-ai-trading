import { defineConfig } from "@playwright/test";

const PORT = 3210;

/** When LIVE_URL is set the suite targets a real deployment (see
 * tests/e2e/live.spec.ts) and must not start a local server. */
const LIVE_URL = process.env.LIVE_URL;

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
    baseURL: LIVE_URL || `http://127.0.0.1:${PORT}`,
    ignoreHTTPSErrors: true,
  },
  webServer: LIVE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
        // The owner suite needs a configured owner; the default is the public owner
        // wallet, so the practice-network and practice-funds paths are reachable in CI.
        env: {
          OWNER_WALLET_ADDRESSES:
            process.env.OWNER_WALLET_ADDRESSES ??
            "0x5a407Ff50d55142c36144B390972c51A768eBf8c",
        },
      },
});
