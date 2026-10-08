import { test, expect } from "@playwright/test";

/**
 * Post-deploy smoke test against a **real** deployment.
 *
 * Skipped unless `LIVE_URL` is set, so it never runs in CI (CI has no
 * deployment) and never starts a local server (see `playwright.config.ts`):
 *
 *   LIVE_URL=https://veylora-fintech-ai-trading.vercel.app \
 *     npx playwright test tests/e2e/live.spec.ts
 *
 * It proves the parts a build cannot: that the deployed database is reachable,
 * the seeded accounts work, a session cookie round-trips, and no secret leaks
 * into a rendered page.
 */

const LIVE_URL = process.env.LIVE_URL;

test.describe("live deployment", () => {
  test.skip(!LIVE_URL, "set LIVE_URL to smoke-test a real deployment");

  test("seeded account signs in and reaches database-backed pages", async ({ page }) => {
    test.setTimeout(180_000);

    // The public entry point renders with the product's own metadata.
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Veylora Fintech AI Trading/);

    // Sign in with the seeded account. This touches the database: the login
    // action reads the User row and verifies a scrypt hash.
    await page.fill("#login-email", "trader@veylora.dev");
    await page.fill("#login-password", "password123");
    await page.getByRole("button", { name: /^Sign in$/ }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    // The login form is gone and the authenticated nav is present, which means
    // the signed session cookie was accepted.
    await expect(page.locator("#login-email")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    // A page that reads persisted rows for this user.
    await page.goto("/history", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();

    // A page that mixes real public market data with the app's own rendering.
    await page.goto("/markets", { waitUntil: "domcontentloaded" });
    await expect(page.locator("table").first()).toBeVisible();

    // No secret ever reaches the browser.
    const html = await page.content();
    expect(html).not.toContain("SESSION_SECRET");
    const dsn = process.env.DATABASE_URL;
    if (dsn) expect(html).not.toContain(dsn);
    expect(html).not.toMatch(/postgres(ql)?:\/\/[^\s"']+:[^\s"'@]+@/);
  });
});
