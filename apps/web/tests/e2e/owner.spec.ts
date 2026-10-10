import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";

/**
 * Owner-only surfaces (end to end):
 *
 *   - the configured owner signs in on a **practice network** and reaches the CRM
 *     console, where an "Owner controls" card credits **practice funds**;
 *   - a non-owner admin never sees that card, whatever network they are on.
 *
 * The Playwright web server is started with `OWNER_WALLET_ADDRESSES` set (see
 * `playwright.config.ts`) to the public owner wallet below; a wallet extension is
 * absent in CI, so — as elsewhere — the session cookie is minted with the app's own
 * signer. The owner check and the network class are derived server-side.
 */

const HOST = "127.0.0.1";
const SEPOLIA = 11155111; // a practice network ⇒ SANDBOX (owner-only)
const BASE_MAINNET = 8453;
const OWNER = "0x5a407ff50d55142c36144b390972c51a768ebf8c"; // must match the web server env

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

test("the owner on a practice network can credit practice funds from the console", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const owner = await prisma.user.upsert({
    where: { walletAddress: OWNER },
    update: { role: "ADMIN" },
    create: {
      walletAddress: OWNER,
      chainId: SEPOLIA,
      name: "Site Owner",
      role: "ADMIN",
      customer: { create: { name: "Site Owner" } },
      wallet: { create: { address: OWNER, kind: "MAINNET", network: "mainnet" } },
    },
  });

  try {
    await signInOn(page.context(), owner.id, SEPOLIA);

    // The practice class is accepted for the owner, so the console renders.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /CRM console/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Owner controls/i })).toBeVisible();

    // Credit practice funds and see the private balance move.
    await page.locator("#owner-amount").fill("250");
    await page.locator('input[name="confirm"]').check();
    await page.getByRole("button", { name: "Credit practice funds" }).click();
    await expect(page.getByText(/Practice funds credited to your account/i)).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("$250.00").first()).toBeVisible();
  } finally {
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("a non-owner admin never sees the owner controls", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const address = `0x${createHash("sha256").update(`admin+${Date.now()}`).digest("hex").slice(0, 40)}`;
  const admin = await prisma.user.create({
    data: {
      walletAddress: address,
      chainId: BASE_MAINNET,
      name: "Plain Admin",
      role: "ADMIN",
      customer: { create: { name: "Plain Admin" } },
      wallet: { create: { address, kind: "MAINNET", network: "mainnet" } },
    },
  });

  try {
    await signInOn(page.context(), admin.id, BASE_MAINNET);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /CRM console/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Owner controls/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Credit practice funds" })).toHaveCount(0);
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorId: admin.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
