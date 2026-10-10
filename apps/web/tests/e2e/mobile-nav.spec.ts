import { test, expect, type Page } from "@playwright/test";

/**
 * The mobile navigation drawer.
 *
 * Below 901px (and when the visitor has not asked for reduced motion) the app
 * header swaps the desktop pill row for `StaggeredMenu`: a full-height panel that
 * GSAP slides in from the left, opened and closed by its `.sm-toggle`. This covers
 * the whole loop a phone visitor actually walks — open, follow a link, and find the
 * drawer closed again on the page it lands on — plus the closed-state contract that
 * keeps the parked panel out of the tab order and the accessibility tree.
 *
 * Signed out, `/` is public and the nav offers Markets and FAQ, so no session is
 * needed.
 */

const PHONE = { width: 375, height: 800 };

const toggle = (page: Page) => page.locator(".sm-toggle");
const panel = (page: Page) => page.locator("#staggered-menu-panel");

/** The panel's x offset: negative while it is parked off-screen, ~0 once open. */
async function panelX(page: Page): Promise<number> {
  const box = await panel(page).boundingBox();
  return box ? Math.round(box.x) : Number.NaN;
}

test.describe("mobile navigation drawer", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
    });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`));
    await page.setViewportSize(PHONE);
  });

  test("opens, navigates with a link, and closes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The drawer is the phone presentation, so its toggle is on screen ...
    await expect(toggle(page)).toBeVisible();

    // ... and it starts closed: off-screen, inert, and hidden from assistive tech.
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toHaveAttribute("aria-hidden", "true");
    await expect(panel(page)).toHaveAttribute("inert", "");
    expect(await panelX(page)).toBeLessThan(0);

    /* Open. The attributes flip synchronously with state; the geometry waits for the
     * slide-in timeline to finish (the panel only reaches x: 0 at its end). */
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page)).toHaveAttribute("aria-hidden", "false");
    await expect(panel(page)).not.toHaveAttribute("inert", "");
    await expect.poll(() => panelX(page)).toBeGreaterThanOrEqual(0);

    /* Follow a link inside the panel — a real navigation, not a client-side route. */
    const markets = panel(page).getByRole("link", { name: "Markets" });
    await expect(markets).toBeVisible();
    await markets.click();
    await expect(page).toHaveURL(/\/markets$/);

    /* The new page starts with the drawer closed, and its toggle still works. */
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toHaveAttribute("aria-hidden", "true");
    await expect(panel(page)).toHaveAttribute("inert", "");
    expect(await panelX(page)).toBeLessThan(0);

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => panelX(page)).toBeGreaterThanOrEqual(0);

    /* Close it again from the open state. */
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toHaveAttribute("aria-hidden", "true");
    await expect(panel(page)).toHaveAttribute("inert", "");
    await expect.poll(() => panelX(page)).toBeLessThan(0);

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});
