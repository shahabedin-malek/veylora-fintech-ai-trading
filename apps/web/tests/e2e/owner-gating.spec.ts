import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";

/**
 * Owner-surface leak guard.
 *
 * The owner-only UI (the "Owner controls" / practice-funds card on `/admin`) is
 * marked with `data-owner-only`. This spec enumerates **every route** from the app
 * tree and loads each one as an anonymous visitor, an ordinary signed-in user, and a
 * **non-owner admin**, asserting the owner-only surface never renders. A non-owner
 * admin is the strongest case: it reaches `/admin` where the card lives, so the guard
 * cannot pass merely because the route redirected.
 *
 * An owner positive control proves the assertion is not vacuous — the same marker
 * must render for the configured owner.
 *
 * The Playwright web server is started with `OWNER_WALLET_ADDRESSES` set to the public
 * owner wallet (see `playwright.config.ts`).
 */

const HOST = "127.0.0.1";
const BASE_MAINNET = 8453;
const OWNER = "0x5a407ff50d55142c36144b390972c51a768ebf8c"; // must match the web server env

/** Every `page.tsx` under `src/app`, as a route path (dynamic segments left intact). */
function enumerateRoutes(): string[] {
  const root = join(process.cwd(), "src", "app");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") {
        const rel = full.slice(root.length).replace(/[\\/]page\.tsx$/, "");
        out.push(rel === "" ? "/" : rel);
      }
    }
  };
  walk(root);
  return out.sort();
}

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

async function signInOn(context: BrowserContext, userId: string): Promise<void> {
  await context.addCookies([
    { name: SESSION_COOKIE, value: createToken(userId, BASE_MAINNET), domain: HOST, path: "/" },
  ]);
}

/** Asserts none of the owner-only markers are present on the current page. */
async function expectNoOwnerSurface(page: Page, label: string): Promise<void> {
  expect(await page.locator("[data-owner-only]").count(), `${label}: owner-only element`).toBe(0);
  expect(
    await page.getByRole("heading", { name: /Owner controls/i }).count(),
    `${label}: owner heading`
  ).toBe(0);
  expect(
    await page.getByRole("button", { name: /Credit practice funds/i }).count(),
    `${label}: owner credit button`
  ).toBe(0);
  expect(await page.locator("#owner-amount").count(), `${label}: owner amount field`).toBe(0);
}

test("no owner-only surface renders on any route for a non-owner", async ({ browser }) => {
  test.setTimeout(300_000);

  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const ticket = await prisma.ticket.findFirst({ orderBy: { createdAt: "desc" } });

  const make = (label: string, role: string) => {
    const address = `0x${createHash("sha256").update(`${label}+${Date.now()}`).digest("hex").slice(0, 40)}`;
    return prisma.user.create({
      data: {
        walletAddress: address,
        chainId: BASE_MAINNET,
        name: label,
        role,
        customer: { create: { name: label } },
        wallet: { create: { address, kind: "MAINNET", network: "mainnet" } },
      },
    });
  };

  const user = await make("Owner Gating User", "USER");
  const admin = await make("Owner Gating Admin", "ADMIN");

  // Every route, resolving the one dynamic segment with a real ticket when present.
  const routes = enumerateRoutes()
    .map((r) => (ticket ? r.replace("[id]", ticket.id) : r))
    .filter((r) => !r.includes("["));

  const roles: { name: string; userId: string | null }[] = [
    { name: "anonymous", userId: null },
    { name: "non-owner user", userId: user.id },
    { name: "non-owner admin", userId: admin.id },
  ];

  try {
    for (const role of roles) {
      const context = await browser.newContext();
      if (role.userId) await signInOn(context, role.userId);
      const page = await context.newPage();

      for (const route of routes) {
        // `networkidle` lets a protected route's client-side redirect to /login settle
        // before the next navigation, so the sweeps cannot race each other.
        await page.goto(route, { waitUntil: "networkidle", timeout: 45_000 });
        await expectNoOwnerSurface(page, `${role.name} ${route}`);
      }

      await context.close();
    }
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

test("positive control: the owner does see the owner-only surface", async ({ page }) => {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const owner = await prisma.user.upsert({
    where: { walletAddress: OWNER },
    update: { role: "ADMIN" },
    create: {
      walletAddress: OWNER,
      chainId: BASE_MAINNET,
      name: "Site Owner",
      role: "ADMIN",
      customer: { create: { name: "Site Owner" } },
      wallet: { create: { address: OWNER, kind: "MAINNET", network: "mainnet" } },
    },
  });

  try {
    await signInOn(page.context(), owner.id);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    // The marker must render for the owner, or the leak guard above proves nothing.
    await expect(page.locator("[data-owner-only]")).toBeVisible();
    await expect(page.getByRole("button", { name: /Credit practice funds/i })).toBeVisible();
  } finally {
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});
