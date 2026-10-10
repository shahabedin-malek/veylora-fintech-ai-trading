import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";
import { SEEDED_ACCOUNTS, SEEDED_CHAIN_ID } from "../../prisma/seed-accounts";

/**
 * Coinbase surfaces (Phase 19), end to end through the real UI:
 *
 *   - the `/login` page offers a one-click "Sign in with Coinbase" entry point
 *   - `/wallet` shows the Coinbase deposit card (address + supported networks)
 *   - `/admin/webhooks` renders the webhook console with a status filter
 *
 * Completing a real Coinbase sign-in needs the wallet extension (absent in CI), so —
 * as with the rest of the suite — the session cookie is minted with the app's own
 * signer and the sign-in *surface* is asserted, not driven.
 */

const HOST = "127.0.0.1";

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

async function signInAs(context: BrowserContext, userId: string): Promise<void> {
  await context.addCookies([
    { name: SESSION_COOKIE, value: createToken(userId, SEEDED_CHAIN_ID), domain: HOST, path: "/" },
  ]);
}

test("login offers a one-click Sign in with Coinbase and leaks nothing", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /sign in with your wallet/i })).toBeVisible();
  // The dedicated Coinbase entry point sits alongside the generic wallet connect.
  await expect(page.getByRole("button", { name: /sign in with coinbase/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /connect/i }).first()).toBeVisible();

  // Still wallet-only: no credential fields.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[name="email"]')).toHaveCount(0);

  const html = await page.content();
  expect(html).not.toContain("SESSION_SECRET");
  expect(html).not.toContain("CDP_API_KEY_SECRET");
});

test("wallet shows the Coinbase deposit card with the account address", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const address = `0x${createHash("sha256").update(`coinbase+${Date.now()}`).digest("hex").slice(0, 40)}`;
  const user = await prisma.user.create({
    data: {
      walletAddress: address,
      chainId: SEEDED_CHAIN_ID,
      name: "Coinbase UI Tester",
      role: "USER",
      customer: { create: { name: "Coinbase UI Tester" } },
      wallet: { create: { address, kind: "MAINNET", network: "mainnet" } },
    },
  });

  try {
    await signInAs(page.context(), user.id);
    await page.goto("/wallet");

    await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deposit with Coinbase/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Withdraw with Coinbase/i })).toBeVisible();

    // The address and the networks the deposit can land on are always shown.
    await expect(page.getByText(address, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Supported networks: ethereum, base/i)).toBeVisible();

    // The per-user Coinbase reconciliation section is present on /history.
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: /Coinbase reconciliation/i })).toBeVisible();
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("admin can view Coinbase webhook events and filter by status", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const admin = await prisma.user.findUnique({
    where: { walletAddress: SEEDED_ACCOUNTS.admin.address },
  });
  await prisma.$disconnect();
  expect(admin, "seeded admin required — run `npm run db:seed` first").toBeTruthy();

  await signInAs(page.context(), admin!.id);
  await page.goto("/admin/webhooks");

  await expect(page.getByRole("heading", { name: /Coinbase webhooks/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /^UNMATCHED/ })).toBeVisible();

  // The filter is a linkable view.
  await page.getByRole("link", { name: /^UNMATCHED/ }).click();
  await expect(page).toHaveURL(/status=UNMATCHED/);
});

test("the webhook console is admin-only", async ({ page }) => {
  await page.goto("/admin/webhooks");
  await expect(page).toHaveURL(/\/login/);
});
