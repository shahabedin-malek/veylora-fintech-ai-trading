import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";

/**
 * Network gating. Public sign-in is mainnet-only; the practice chains are
 * **owner-only**. A non-owner session (even one minted directly on a practice chain,
 * as here) is refused on every read: `getCurrentUser` returns null, so the route
 * redirects to `/login` and no practice surface is ever rendered.
 *
 * Sign-in needs a wallet extension (absent in CI), so — as elsewhere in the suite —
 * the session cookie is minted with the app's own signer for a throwaway account on a
 * chosen chain. The network class and the owner check are derived server-side.
 */

const HOST = "127.0.0.1";
const BASE_MAINNET = 8453; // Base ⇒ MAINNET
const SEPOLIA = 11155111; // a practice network ⇒ SANDBOX (owner-only)

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

async function signInOn(context: BrowserContext, userId: string, chainId: number): Promise<void> {
  await context.addCookies([
    { name: SESSION_COOKIE, value: createToken(userId, chainId), domain: HOST, path: "/" },
  ]);
}

/** A throwaway account on a specific chain, with the wallet row the app expects. */
async function makeUser(prisma: PrismaClient, chainId: number, label: string) {
  const address = `0x${createHash("sha256").update(`${label}+${Date.now()}`).digest("hex").slice(0, 40)}`;
  return prisma.user.create({
    data: {
      walletAddress: address,
      chainId,
      name: "Wallet Network Tester",
      role: "USER",
      customer: { create: { name: "Wallet Network Tester" } },
      wallet: { create: { address, kind: "MAINNET", network: "mainnet" } },
    },
  });
}

test("a practice-network session is refused for a non-owner", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const user = await makeUser(prisma, SEPOLIA, "wallet-net-practice");

  try {
    await signInOn(page.context(), user.id, SEPOLIA);
    await page.goto("/wallet");
    // The practice class does not resolve to a usable session for an ordinary user.
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("a mainnet session reaches the real wallet surfaces and no practice controls", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const user = await makeUser(prisma, BASE_MAINNET, "wallet-net-mainnet");

  try {
    await signInOn(page.context(), user.id, BASE_MAINNET);
    await page.goto("/wallet");

    await expect(page.getByRole("heading", { name: /^Wallet$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deposit with Coinbase/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Withdraw with Coinbase/i })).toBeVisible();
    // No practice surface leaks to an ordinary user.
    await expect(page.getByText(/practice funds/i)).toHaveCount(0);

    // Registration keys never reach the rendered page.
    const html = await page.content();
    expect(html).not.toContain("CDP_WALLET_SECRET");
    expect(html).not.toContain("CDP_API_KEY_SECRET");
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
