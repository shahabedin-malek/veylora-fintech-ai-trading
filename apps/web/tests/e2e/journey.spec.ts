import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, createToken } from "../../src/lib/session-token";
import { SEEDED_ACCOUNTS, SEEDED_CHAIN_ID } from "../../prisma/seed-accounts";

/**
 * Full-journey test, end to end through the real UI — the **real-funds** product:
 *
 *   sign in -> dashboard (mainnet account)
 *           -> wallet (real Coinbase on/off-ramp + on-chain custody surfaces)
 *           -> trade desk (custody-signed Coinbase swap surface)
 *           -> history (transactions / ledger / Coinbase reconciliation)
 *           -> open a support ticket
 *           -> admin replies, customer sees it
 *
 * The app moves real funds, so there is no deposit/withdraw/swap to execute without
 * live custody and Coinbase credentials — those money paths are gated and are covered
 * by the integration suite (which mocks only the provider SDK). This journey proves
 * the surfaces and the CRM loop, and asserts that no owner-only practice control ever
 * leaks to an ordinary account.
 *
 * Sign-in is wallet-based (SIWE), which cannot be driven from Playwright without a
 * wallet extension — so the session cookie is minted with the app's own signer for a
 * fresh account on a mainnet chain. That still exercises the real session verification
 * on every request; the signature flow itself is covered by the integration SIWE suite
 * and the wallet-connect surface is asserted in `login-wallet.spec.ts`.
 *
 * A fresh account is created per run so the journey is deterministic and re-runnable.
 * It is deleted afterwards.
 */

/** Mirrors the playwright webServer host, which the session cookie is scoped to. */
const HOST = "127.0.0.1";

const RUN = Date.now();
const LABEL = `journey+${RUN}`;
const NAME = "Journey Tester";

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

/** A deterministic wallet address for a throwaway account. */
function walletFor(label: string): string {
  return `0x${createHash("sha256").update(label).digest("hex").slice(0, 40)}`;
}

async function signInAs(context: BrowserContext, userId: string): Promise<void> {
  await context.addCookies([
    { name: SESSION_COOKIE, value: createToken(userId, SEEDED_CHAIN_ID), domain: HOST, path: "/" },
  ]);
}

test("full journey: sign in → dashboard → wallet → trade → history → ticket → admin reply", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const replyText = `Automated reply ${RUN}`;

  // The .env file is gitignored, so CI supplies the secret as an env var.
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const address = walletFor(LABEL);

  // Sign-in itself is covered elsewhere; start from a provisioned account.
  const user = await prisma.user.create({
    data: {
      walletAddress: address,
      chainId: SEEDED_CHAIN_ID,
      name: NAME,
      role: "USER",
      customer: { create: { name: NAME } },
      wallet: { create: { address, kind: "MAINNET", network: "mainnet" } },
    },
  });
  const admin = await prisma.user.findUnique({
    where: { walletAddress: SEEDED_ACCOUNTS.admin.address },
  });
  expect(admin, "seeded admin required — run `npm run db:seed` first").toBeTruthy();

  try {
    /* ------------------------------------------------ 1. signed in */
    await signInAs(page.context(), user.id);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: new RegExp(NAME.split(" ")[0], "i") })).toBeVisible();
    await expect(page.getByText(/Mainnet account/i)).toBeVisible();
    await expect(page.getByText("Account balance")).toBeVisible();

    /* ------------------------------------------------ 2. wallet surfaces */
    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: /^Wallet$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Balance" })).toBeVisible();
    // Real funding paths: a Coinbase-hosted deposit/withdrawal and on-chain custody.
    await expect(page.getByRole("heading", { name: /Deposit with Coinbase/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Withdraw with Coinbase/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deposit & withdraw on-chain/i })).toBeVisible();
    // No owner-only practice surface leaks to an ordinary account.
    await expect(page.getByText(/practice funds/i)).toHaveCount(0);

    /* ------------------------------------------------ 3. trade desk */
    await page.goto("/trade");
    await expect(page).toHaveURL(/\/trade/);
    await expect(page.getByRole("heading", { name: /Trading desk/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Coinbase swap/i })).toBeVisible();

    /* ------------------------------------------------ 4. history */
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: /^History$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Transactions$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Ledger$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Coinbase reconciliation/i })).toBeVisible();

    /* ------------------------------------------------ 5. support ticket */
    await page.goto("/support");
    const subject = `Journey ticket ${RUN}`;
    const body = "I have a question about a withdrawal.";
    await page.locator("#subject").fill(subject);
    await page.locator("#body").fill(body);
    await page.getByRole("button", { name: "Start conversation" }).click();

    await expect(page).toHaveURL(/ticket=/);
    const ticketId = new URL(page.url()).searchParams.get("ticket");
    expect(ticketId, "ticket id should be present in the URL").toBeTruthy();
    await expect(page.getByRole("heading", { name: subject })).toBeVisible();
    await expect(page.getByText(body)).toBeVisible();

    /* ------------------------------------------------ 6. admin replies */
    const adminContext = await browser.newContext();
    await signInAs(adminContext, admin!.id);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin");
    await expect(adminPage.getByRole("heading", { name: "CRM console" })).toBeVisible();

    // The ticket is visible in the console...
    await expect(adminPage.getByText(subject)).toBeVisible();

    // ...and can be triaged and answered.
    await adminPage.goto(`/admin/tickets/${ticketId}`);
    await adminPage.locator("#priority").selectOption("HIGH");
    await adminPage.locator("#body").fill(replyText);
    await Promise.all([
      adminPage.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes(`/admin/tickets/${ticketId}`)
      ),
      adminPage.getByRole("button", { name: "Update ticket" }).click(),
    ]);

    await adminPage.reload();
    await expect(adminPage.getByText(replyText)).toBeVisible();
    await expect(adminPage.locator("#priority")).toHaveValue("HIGH");
    await adminContext.close();

    /* ------------------------------- 7. customer sees the admin reply */
    await page.goto(`/support?ticket=${ticketId}`);
    await expect(page.getByText(replyText)).toBeVisible();
  } finally {
    // Clean up the throwaway account (cascades to wallet/ledger/tickets/messages).
    try {
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    } finally {
      await prisma.$disconnect();
    }
  }
});
