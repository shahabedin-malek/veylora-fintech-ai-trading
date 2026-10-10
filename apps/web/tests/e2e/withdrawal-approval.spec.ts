import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";

/**
 * The withdrawal approval workflow, end to end.
 *
 * A plain user cannot move money out: they **request** a withdrawal, the amount is held
 * from their balance, and an admin decides it in the CRM. These tests drive that through
 * the UI and assert the outcome that matters in each case:
 *
 *   - requesting holds the amount and shows the request as awaiting review;
 *   - **declining returns the amount** to the user's balance (a refusal is not a
 *     forfeiture) and shows them the reason;
 *   - **approving** clears/ settles the request.
 *
 * The Coinbase hand-off rail is used because it needs no custody backend and no live
 * price — the app never signs that flow. (An on-chain request is priced from a live
 * quote, which a test environment does not have; the on-chain payout path is covered by
 * the integration suite, where the custody signer and the quote are controlled.)
 *
 * No wallet extension exists in CI, so sessions are minted with the app's own signer,
 * exactly as the other specs do.
 */

const HOST = "127.0.0.1";
const BASE_MAINNET = 8453;
const STARTING_BALANCE = 250_000; // $2,500

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

function randomAddress(label: string): string {
  return `0x${createHash("sha256").update(`${label}+${Date.now()}+${Math.random()}`).digest("hex").slice(0, 40)}`;
}

function useSecret(): void {
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;
}

/** Create a tier-appropriate account with a funded wallet. */
async function makeAccount(prisma: PrismaClient, role: "USER" | "ADMIN", label: string) {
  const address = randomAddress(label.toLowerCase().replace(/\s+/g, "-"));
  return prisma.user.create({
    data: {
      walletAddress: address,
      chainId: BASE_MAINNET,
      name: label,
      role,
      customer: { create: { name: label } },
      wallet: { create: { address, kind: "MAINNET", network: "mainnet", balanceCents: STARTING_BALANCE } },
    },
  });
}

/** The queue/holds sections, so a row locator cannot match the same account twice. */
function section(page: import("@playwright/test").Page, heading: RegExp) {
  return page.locator("section", { has: page.getByRole("heading", { name: heading }) });
}

/** Submit a withdrawal request from the wallet page (Coinbase route, amount in USD). */
async function requestWithdrawal(page: import("@playwright/test").Page, amount: string) {
  await page.goto("/wallet");
  await page.locator("#request-rail").selectOption("COINBASE_OFFRAMP");
  await page.locator("#request-amount").fill(amount);
  await page.locator('form:has(#request-amount) input[name="confirm"]').check();
  await page.getByRole("button", { name: "Request withdrawal" }).click();
  await expect(page.getByText(/Request submitted/i)).toBeVisible();
}

test("a user requests a withdrawal, an admin declines it, and the amount comes back", async ({ browser }) => {
  useSecret();
  const prisma = new PrismaClient();
  const applicant = await makeAccount(prisma, "USER", "Withdrawal Applicant");
  const admin = await makeAccount(prisma, "ADMIN", "Withdrawal Admin");

  try {
    // The applicant requests $500: the amount is held, not sent.
    const userContext = await browser.newContext();
    await signInOn(userContext, applicant.id);
    const userPage = await userContext.newPage();
    await requestWithdrawal(userPage, "500");

    await expect(userPage.getByText(/Awaiting review/i).first()).toBeVisible();
    const held = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicant.id } });
    expect(held.balanceCents).toBe(STARTING_BALANCE - 50_000);
    await userContext.close();

    // The admin refuses it, with a reason.
    const adminContext = await browser.newContext();
    await signInOn(adminContext, admin.id);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/withdrawals");
    const row = section(adminPage, /Awaiting review/i).locator("tr", { hasText: applicant.name });
    await expect(row).toHaveCount(1);
    await row.locator('input[name="reason"]').fill("destination not verified with the customer");
    await row.getByRole("button", { name: /Decline and return funds/i }).click();
    await expect(adminPage.getByText(/no funds moved/i)).toBeVisible();
    await adminContext.close();

    // The money is back with its owner — the whole point of a decline.
    const afterDecline = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicant.id } });
    expect(afterDecline.balanceCents).toBe(STARTING_BALANCE);

    const backContext = await browser.newContext();
    await signInOn(backContext, applicant.id);
    const backPage = await backContext.newPage();
    await backPage.goto("/wallet");
    await expect(backPage.getByText(/Declined/).first()).toBeVisible();
    await expect(backPage.getByText(/destination not verified with the customer/).first()).toBeVisible();
    await backContext.close();
  } finally {
    for (const id of [applicant.id, admin.id]) {
      await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { actorId: id } }).catch(() => undefined);
      await prisma.ledgerEntry.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.transaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.idempotencyKey.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.withdrawalRequest.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
});

test("an admin approves a request and it settles", async ({ browser }) => {
  useSecret();
  const prisma = new PrismaClient();
  const applicant = await makeAccount(prisma, "USER", "Approved Applicant");
  const admin = await makeAccount(prisma, "ADMIN", "Approving Admin");

  try {
    const userContext = await browser.newContext();
    await signInOn(userContext, applicant.id);
    const userPage = await userContext.newPage();
    await requestWithdrawal(userPage, "300");
    await userContext.close();

    const adminContext = await browser.newContext();
    await signInOn(adminContext, admin.id);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/withdrawals");
    const row = section(adminPage, /Awaiting review/i).locator("tr", { hasText: applicant.name });
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(adminPage.getByText(/Approved\./i)).toBeVisible();
    await adminContext.close();

    const request = await prisma.withdrawalRequest.findFirstOrThrow({ where: { userId: applicant.id } });
    expect(request.status).toBe("APPROVED");
    expect(request.decidedById).toBe(admin.id);
    // The Coinbase rail is a clearance: the app never signs it, so the reservation is
    // released here and the real debit arrives later as a reconciled webhook.
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicant.id } });
    expect(wallet.balanceCents).toBe(STARTING_BALANCE);
  } finally {
    for (const id of [applicant.id, admin.id]) {
      await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { actorId: id } }).catch(() => undefined);
      await prisma.ledgerEntry.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.transaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.idempotencyKey.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.withdrawalRequest.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
});

test("an account hold freezes movement, keeps the balance, and does not let a request through", async ({ browser }) => {
  useSecret();
  const prisma = new PrismaClient();
  const applicant = await makeAccount(prisma, "USER", "Held Applicant");
  const admin = await makeAccount(prisma, "ADMIN", "Holding Admin");

  try {
    const adminContext = await browser.newContext();
    await signInOn(adminContext, admin.id);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/withdrawals");
    const row = section(adminPage, /Account holds/i).locator("tr", { hasText: applicant.name });
    // The row also carries a ban form with its own reason field, so scope to the hold form.
    const holdForm = row.locator("form").filter({ has: adminPage.getByRole("button", { name: "Place hold" }) });
    await holdForm.locator('input[name="reason"]').fill("suspected abuse — under review");
    await holdForm.getByRole("button", { name: "Place hold" }).click();
    await expect(adminPage.getByText(/balance is untouched/i)).toBeVisible();
    await adminContext.close();

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicant.id } });
    expect(wallet.blocked).toBe(true);
    expect(wallet.balanceCents).toBe(STARTING_BALANCE); // frozen, not taken

    // The user cannot request a withdrawal while held, and the page says so.
    const userContext = await browser.newContext();
    await signInOn(userContext, applicant.id);
    const userPage = await userContext.newPage();
    await userPage.goto("/wallet");
    await expect(userPage.getByText(/This account is on hold/i).first()).toBeVisible();
    await expect(userPage.locator("#request-amount")).toHaveCount(0);
    await userContext.close();

    // Lifting the hold restores access with the balance intact.
    const releaseContext = await browser.newContext();
    await signInOn(releaseContext, admin.id);
    const releasePage = await releaseContext.newPage();
    await releasePage.goto("/admin/withdrawals");
    await section(releasePage, /Account holds/i)
      .locator("tr", { hasText: applicant.name })
      .getByRole("button", { name: /Lift hold/i })
      .click();
    await expect(releasePage.getByText(/Hold lifted/i)).toBeVisible();
    await releaseContext.close();

    const cleared = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicant.id } });
    expect(cleared.blocked).toBe(false);
    expect(cleared.balanceCents).toBe(STARTING_BALANCE);
  } finally {
    for (const id of [applicant.id, admin.id]) {
      await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { actorId: id } }).catch(() => undefined);
      await prisma.ledgerEntry.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.transaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.idempotencyKey.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.withdrawalRequest.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
});
