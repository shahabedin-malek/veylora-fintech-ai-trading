import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Final walkthrough gate — runs in a genuinely fresh browser context (no cookies,
 * no storage state). It covers the checks the journey and UI-audit specs do not:
 *
 *   1. public pages load with real content (nothing 4xx/5xx)
 *   2. the markets page renders a chart, the instrument table and the news section
 *   3. no secret (or the string SESSION_SECRET) leaks into any rendered page
 *   4. every protected route redirects an unauthenticated visitor to /login
 *      without leaking its content
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

const PUBLIC = ["/", "/login", "/faq", "/markets"];
const PROTECTED = ["/dashboard", "/trade", "/wallet", "/history", "/support", "/admin"];

test("fresh session walkthrough: public content, protected redirects, no secret exposure", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // The .env file is gitignored, so CI supplies the secret as an env var.
  const secret = process.env.SESSION_SECRET ?? readEnv().SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set (apps/web/.env or the environment)").toBeTruthy();

  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`));

  /* 1. Public pages load. */
  for (const path of PUBLIC) {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0, `${path} status`).toBeLessThan(400);
  }

  /* 2. Markets renders its real surfaces (chart, table, news). */
  await page.goto("/markets", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "All instruments" })).toBeVisible();
  // Exact: the sidebar also has a heading ("Live market news") that contains "News".
  await expect(page.getByRole("heading", { name: "News", exact: true })).toBeVisible();
  expect(await page.locator("svg").count(), "a chart should be drawn").toBeGreaterThan(0);
  // Every instrument is labelled with its source badge.
  expect(
    await page.locator(".badge").count(),
    "instrument/news source labels should be present"
  ).toBeGreaterThan(0);
  // The feed is browsable by asset class, and the filter is a plain link — it works
  // without JS and the URL stays the source of truth.
  await expect(page.getByRole("group", { name: /Filter news by asset class/i })).toBeVisible();
  await page.getByRole("link", { name: /^Crypto/ }).first().click();
  await expect(page).toHaveURL(/news=crypto/);
  await expect(page.getByRole("heading", { name: "News", exact: true })).toBeVisible();

  /* 3. No secret leakage into any rendered page. */
  for (const path of PUBLIC) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const html = await page.content();
    expect(html, `${path} must not embed the session secret`).not.toContain(secret!);
    expect(html, `${path} must not mention SESSION_SECRET`).not.toContain("SESSION_SECRET");
  }

  /* 4. Protected routes redirect a fresh visitor and render no protected content. */
  for (const path of PROTECTED) {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0, `${path} must not 5xx`).toBeLessThan(500);
    await expect(page, `${path} should redirect to /login`).toHaveURL(/\/login/);
    // It must land on the sign-in page, not on the protected page itself.
    await expect(page.getByRole("heading", { name: /sign in with your wallet/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /CRM console/ })).toHaveCount(0);
    await expect(page.getByText("Account balance")).toHaveCount(0);
  }

  /* 5. The fresh sweep stays free of console errors. */
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  await context.close();
});
