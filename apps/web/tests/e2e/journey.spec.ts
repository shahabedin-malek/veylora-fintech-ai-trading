import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Full-journey test, end to end through the real UI:
 *
 *   register -> sign out -> log in
 *   -> deposit simulated funds  (STATE 1 -> STATE 2)
 *   -> start trading            (STATE 2 -> STATE 3)
 *   -> force stop (< 5 min)     (STATE 3 -> STATE 4)
 *   -> withdraw (simulated fee breakdown)
 *   -> open a support ticket
 *   -> admin replies, customer sees it
 *
 * A fresh account is created per run so the journey is deterministic and
 * re-runnable. It is deleted afterwards.
 */

const RUN = Date.now();
const EMAIL = `journey+${RUN}@veylora.dev`;
const PASSWORD = "journey-pass-123";
const NAME = "Journey Tester";

const ADMIN_EMAIL = "admin@veylora.dev";
const ADMIN_PASSWORD = "admin12345";

const DEPOSIT_USD = 100;

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("full journey: register → login → deposit → trade → force stop → withdraw → ticket → admin reply", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const replyText = `Automated reply ${RUN}`;

  try {
    /* ------------------------------------------------ 1. register (fresh) */
    await page.goto("/login");
    await page.locator("#reg-name").fill(NAME);
    await page.locator("#reg-email").fill(EMAIL);
    await page.locator("#reg-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: new RegExp(NAME.split(" ")[0], "i") })).toBeVisible();

    /* ------------------------------------------------ 2. sign out + log in */
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    await loginAs(page, EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Simulated balance")).toBeVisible();

    // STATE 1: signed in, no funds -> Start trading must be disabled.
    await expect(page.getByRole("button", { name: /Start trading/ })).toHaveCount(0);

    /* ------------------------------------------------ 3. deposit funds */
    await page.goto("/wallet");
    await page.locator("#amount").fill(String(DEPOSIT_USD));
    await page.getByRole("button", { name: "Deposit simulated funds" }).click();
    await expect(page.getByText("$100.00").first()).toBeVisible();

    // STATE 2: funded -> Start trading becomes available.
    await page.goto("/dashboard");
    const startBtn = page.getByRole("button", { name: /Start trading/ });
    await expect(startBtn).toBeVisible();

    /* ------------------------------------------------ 4. start trading */
    await startBtn.click();
    // STATE 3 confirmed on the dashboard itself: Start becomes Stop.
    await expect(page.getByRole("button", { name: /Stop trading/ })).toBeVisible();

    await page.goto("/trade");
    await expect(page).toHaveURL(/\/trade/);
    // STATE 3: withdrawal is blocked while trading.
    const stopBtn = page.getByRole("button", { name: /Stop trading/ });
    await expect(stopBtn).toBeVisible();
    await expect(page.getByText(/Trading is active/)).toBeVisible();
    await expect(page.getByText("Simulated activity stream")).toBeVisible();

    /* ------------------------------- 5. force stop (inside the 5-min guard) */
    await stopBtn.click();
    // A warning dialog appears with a Force Stop action.
    const warning = page.getByRole("alertdialog", { name: /Stop trading warning/ });
    await expect(warning).toBeVisible();
    await warning.getByRole("button", { name: "Force Stop" }).click();

    // STATE 4: stopped -> Start is available again.
    await expect(page.getByRole("button", { name: /Start trading/ })).toBeVisible();

    /* ------------------------------------------------ 6. withdraw */
    await page.goto("/wallet");
    const withdrawBtn = page.getByRole("button", { name: /^Withdraw/ });
    await expect(withdrawBtn).toBeEnabled();
    await expect(page.getByText("Withdrawal total")).toBeVisible();
    await expect(page.getByText(/Simulated fee/)).toBeVisible();
    await withdrawBtn.click();
    await expect(page.getByText("$0.00").first()).toBeVisible();

    // The withdrawal is recorded in history.
    await page.goto("/history");
    await expect(page.getByText("WITHDRAWAL").first()).toBeVisible();

    /* ------------------------------------------------ 7. support ticket */
    await page.goto("/support");
    const subject = `Journey ticket ${RUN}`;
    const body = "I stopped trading — where do I withdraw?";
    await page.locator("#subject").fill(subject);
    await page.locator("#body").fill(body);
    await page.getByRole("button", { name: "Start conversation" }).click();

    await expect(page).toHaveURL(/ticket=/);
    const ticketId = new URL(page.url()).searchParams.get("ticket");
    expect(ticketId, "ticket id should be present in the URL").toBeTruthy();
    await expect(page.getByRole("heading", { name: subject })).toBeVisible();
    await expect(page.getByText(body)).toBeVisible();

    /* ------------------------------------------------ 8. admin replies */
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(adminPage).toHaveURL(/\/admin/);
    await expect(adminPage.getByRole("heading", { name: "CRM console" })).toBeVisible();

    // The ticket is visible in the console...
    await expect(adminPage.getByText(subject)).toBeVisible();

    // ...and can be triaged and answered.
    await adminPage.goto(`/admin/tickets/${ticketId}`);
    await adminPage.locator("#priority").selectOption("HIGH");
    await adminPage.locator("#body").fill(replyText);
    // The form is a Next server action: wait for its POST to settle before
    // reloading, otherwise the reload can race the in-flight write.
    await Promise.all([
      adminPage.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes(`/admin/tickets/${ticketId}`)
      ),
      adminPage.getByRole("button", { name: "Update ticket" }).click(),
    ]);

    // Reload so the assertions read a fresh server render (uncontrolled inputs
    // would otherwise mask whether the change actually persisted).
    await adminPage.reload();
    await expect(adminPage.getByText(replyText)).toBeVisible();
    await expect(adminPage.locator("#priority")).toHaveValue("HIGH");
    await adminContext.close();

    /* ------------------------------- 9. customer sees the admin reply */
    await page.goto(`/support?ticket=${ticketId}`);
    await expect(page.getByText(replyText)).toBeVisible();
  } finally {
    // Clean up the throwaway account (cascades to wallet/ledger/tickets/messages).
    const prisma = new PrismaClient();
    try {
      const user = await prisma.user.findUnique({ where: { email: EMAIL } });
      if (user) {
        await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  }
});
