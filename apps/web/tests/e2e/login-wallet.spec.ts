import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The public sign-in surface.
 *
 * There is no email or password any more, so this asserts what a visitor actually
 * gets: a wallet-connect control, no credential fields, and no secret on the page.
 * Completing a sign-in needs a wallet extension, which CI does not have — that
 * path is covered by the integration SIWE suite (real signatures) and the minted-
 * session journey spec.
 */

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = join(process.cwd(), ".env");
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

test("sign-in is wallet-only and leaks nothing", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /sign in with your wallet/i })).toBeVisible();

  // No password or email inputs of any kind.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.locator("#login-password")).toHaveCount(0);

  // A wallet-connect control is offered.
  await expect(page.getByRole("button", { name: /connect/i }).first()).toBeVisible();

  const html = await page.content();
  expect(html).not.toContain("SESSION_SECRET");
  expect(html).not.toContain("privateKey");
});

/**
 * The WalletConnect connector is only added to the wagmi config when a real
 * project id is configured, so this asserts the goal of setting one: the
 * QR/mobile option actually appears in the connect modal.
 */
test("WalletConnect is offered when a project id is configured", async ({ page }) => {
  const projectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? readEnv().NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  test.skip(!projectId, "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured");

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /connect/i }).first().click();

  await expect(page.getByText(/walletconnect/i).first()).toBeVisible({ timeout: 20_000 });
  // A rejected project id/origin surfaces as a Reown 403 — never acceptable.
  expect(consoleErrors.filter((e) => /403|Allowlist|reown/i.test(e))).toEqual([]);
});
