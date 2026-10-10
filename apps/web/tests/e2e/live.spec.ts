import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";
import { SEEDED_ACCOUNTS, SEEDED_CHAIN_ID } from "../../prisma/seed-accounts";

/**
 * Post-deploy smoke test against a **real** deployment.
 *
 * Skipped unless `LIVE_URL` is set, so it never runs in CI (CI has no
 * deployment) and never starts a local server (see `playwright.config.ts`):
 *
 *   set -a; . ./apps/web/.env.deploy; set +a
 *   LIVE_URL=https://veylora-fintech-ai-trading.vercel.app \
 *     npx playwright test tests/e2e/live.spec.ts
 *
 * It proves the parts a build cannot: the sign-in surface ships, a signed session
 * round-trips against the deployed database, database-backed pages render, and no
 * secret leaks into a rendered page.
 *
 * The authenticated checks mint a session cookie for the *seeded* account. That
 * needs the deployment's `SESSION_SECRET`; without it those checks skip. Signing in
 * with a real wallet is not possible from CI, which is why the token is minted
 * rather than the wallet flow completed.
 */

const LIVE_URL = process.env.LIVE_URL;

/** Reads KEY=value from a local env file (gitignored, never committed). */
function readFromEnvFile(file: string, key: string): string | undefined {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.startsWith(`${key}=`)) continue;
    return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
  }
  return undefined;
}

function readDeploySecret(): string | undefined {
  return process.env.SESSION_SECRET ?? readFromEnvFile(".env.deploy", "SESSION_SECRET");
}

test.describe("live deployment", () => {
  test.skip(!LIVE_URL, "set LIVE_URL to smoke-test a real deployment");

  test("the wallet sign-in surface ships", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Veylora Fintech AI Trading/);
    await expect(page.getByRole("heading", { name: /sign in with your wallet/i })).toBeVisible();
    // The password sign-in is gone for good.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // A protected route bounces an anonymous visitor to the sign-in page.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);

    // No secret ever reaches the browser.
    const html = await page.content();
    expect(html).not.toContain("SESSION_SECRET");
    const dsn = process.env.DATABASE_URL;
    if (dsn) expect(html).not.toContain(dsn);
    expect(html).not.toMatch(/postgres(ql)?:\/\/[^\s"']+:[^\s"'@]+@/);

    // The WalletConnect connector is offered when a project id was configured at
    // build time — and Reown's origin check must accept this deployment's origin
    // (a rejected project id/origin shows up as a 403).
    const projectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
      readFromEnvFile(".env", "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    if (projectId) {
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
      });
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /connect/i }).first().click();
      await expect(page.getByText(/walletconnect/i).first()).toBeVisible({ timeout: 20_000 });
      expect(
        consoleErrors.filter((e) => /403|Allowlist|reown/i.test(e)),
        "no WalletConnect project/origin rejection"
      ).toEqual([]);
    }
  });

  test("a signed session reaches database-backed pages", async ({ page, context }) => {
    test.setTimeout(180_000);
    const secret = readDeploySecret();
    test.skip(!secret, "set SESSION_SECRET (or apps/web/.env.deploy) to check the seeded account");

    process.env.SESSION_SECRET = secret;
    const host = new URL(LIVE_URL!).hostname;
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: createToken(SEEDED_ACCOUNTS.trader.id, SEEDED_CHAIN_ID),
        domain: host,
        path: "/",
      },
    ]);

    // Reaches an authenticated page: the session cookie was accepted.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    // A page that reads persisted rows for this user — proves the DB is reachable.
    await page.goto("/history", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();

    // A page that mixes real public market data with the app's own rendering.
    await page.goto("/markets", { waitUntil: "domcontentloaded" });
    await expect(page.locator("table").first()).toBeVisible();
  });
});
