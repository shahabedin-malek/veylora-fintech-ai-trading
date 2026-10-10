import { test, expect, type Browser } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createToken } from "../../src/lib/session-token";
import { SEEDED_ACCOUNTS, SEEDED_CHAIN_ID } from "../../prisma/seed-accounts";

/* ------------------------------------------------------------------ setup */

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

type Role = "none" | "user" | "admin";

interface RouteDef {
  path: string;
  role: Role;
  expect404?: boolean;
  label?: string;
  /**
   * Defaults to `reduce`. Set `no-preference` to audit the *animated* branch of a
   * page instead of its reduced-motion fallback — the two render different markup
   * (e.g. the landing hero swaps `SplitText` for the WebGL `WarpText`), so auditing
   * only one of them leaves the other unverified.
   */
  motion?: "reduce" | "no-preference";
}

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

/* ---------------------------------------------------- in-page audit scripts */

/** Detects document-level horizontal overflow and the elements causing it. */
function detectOverflow() {
  const vw = window.innerWidth;
  const docOverflow = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0
  ) - vw;

  const selector = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return cls ? `${tag}.${cls}` : tag;
  };

  const offenders: { sel: string; right: number; width: number; text: string }[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1) continue;
    let cur: Element | null = el.parentElement;
    let scrollable = false;
    while (cur) {
      const ox = getComputedStyle(cur).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") {
        scrollable = true;
        break;
      }
      cur = cur.parentElement;
    }
    if (!scrollable) {
      offenders.push({
        sel: selector(el),
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }
  return { docOverflow: Math.round(docOverflow), offenders: offenders.slice(0, 15) };
}

/** Computes WCAG contrast for every element that directly owns text. */
function detectContrast() {
  type C = { r: number; g: number; b: number; a: number };
  const parse = (c: string): C | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((s) => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lum = (c: C) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a: C, b: C) => {
    const l1 = lum(a);
    const l2 = lum(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };
  /** An opaque gradient stop fully covers the background-color beneath it. */
  const opaqueGradientStop = (img: string): C | null => {
    const found = img.match(/rgba?\([^)]*\)/g);
    if (!found) return null;
    for (const c of found) {
      const p = parse(c);
      if (p && p.a >= 0.9) return p;
    }
    return null;
  };
  const effectiveBg = (el: Element): C => {
    let cur: Element | null = el;
    while (cur) {
      const s = getComputedStyle(cur);
      if (s.backgroundImage && s.backgroundImage !== "none") {
        const g = opaqueGradientStop(s.backgroundImage);
        if (g) return g;
      }
      const c = parse(s.backgroundColor);
      if (c && c.a > 0.5) return c;
      cur = cur.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const selector = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return cls ? `${tag}.${cls}` : tag;
  };

  const flagged: {
    sel: string;
    text: string;
    color: string;
    bg: string;
    fontSize: number;
    ratio: number;
    required: number;
  }[] = [];

  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (el.closest("svg")) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    const ownsText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent || "").trim().length > 0
    );
    if (!ownsText) continue;
    // Disabled controls are exempt from WCAG 1.4.3 contrast requirements.
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    const fg = parse(s.color);
    if (!fg || fg.a === 0) continue;
    const bg = effectiveBg(el);
    const cr = ratio(fg, bg);
    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight || "400", 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;
    if (cr < required) {
      flagged.push({
        sel: selector(el),
        text: (el.textContent || "").trim().slice(0, 50),
        color: s.color,
        bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        fontSize: Math.round(size * 10) / 10,
        ratio: Math.round(cr * 100) / 100,
        required,
      });
    }
  }
  // de-duplicate by selector+color, keep worst
  const map = new Map<string, (typeof flagged)[number]>();
  for (const f of flagged) {
    const key = `${f.sel}|${f.color}|${f.bg}`;
    const prev = map.get(key);
    if (!prev || f.ratio < prev.ratio) map.set(key, f);
  }
  return Array.from(map.values()).sort((a, b) => a.ratio - b.ratio).slice(0, 40);
}

/**
 * Detects a live region nested inside another live region.
 *
 * Two nested live regions make a screen reader announce the same change twice, and
 * nothing about the markup looks wrong until you check for it specifically — the
 * `/trade` terminal shipped a `role="status"` chip inside its `role="log"` stream,
 * so every terminal event was read out twice.
 *
 * `log`, `status`, `alert`, `timer` and `marquee` are implicitly live; `aria-live`
 * (anything but `off`) is the explicit form.
 */
function detectNestedLiveRegions() {
  const LIVE_ROLES = new Set(["log", "status", "alert", "timer", "marquee"]);

  const isLive = (el: Element): boolean => {
    const role = el.getAttribute("role") ?? "";
    const live = el.getAttribute("aria-live");
    return LIVE_ROLES.has(role) || (live !== null && live !== "off");
  };

  const selector = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${cls ? `${tag}.${cls}` : tag}[role=${el.getAttribute("role") ?? "-"}]`;
  };

  const nested: { inner: string; outer: string }[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (!isLive(el)) continue;
    let cur: Element | null = el.parentElement;
    while (cur) {
      if (isLive(cur)) {
        nested.push({ inner: selector(el), outer: selector(cur) });
        break;
      }
      cur = cur.parentElement;
    }
  }
  return nested;
}

/* ------------------------------------------------------------------ report */

interface Finding {
  kind: "overflow" | "contrast" | "aria" | "console";
  viewport: string;
  route: string;
  detail: string;
}
const findings: Finding[] = [];
const checked: { viewport: string; route: string; status: number }[] = [];

/* --------------------------------------------------------------------- test */

test("every page is free of horizontal overflow, contrast failures and nested live regions at 3 widths", async ({ browser }) => {
  test.setTimeout(300_000);

  const env = readEnv();
  // The .env file is gitignored, so CI supplies the secret as an env var.
  const secret = process.env.SESSION_SECRET ?? env.SESSION_SECRET;
  expect(secret, "SESSION_SECRET must be set in apps/web/.env").toBeTruthy();
  // Tokens are minted with the app's own signer, so the same secret must be used.
  process.env.SESSION_SECRET = secret;

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { walletAddress: SEEDED_ACCOUNTS.trader.address },
  });
  const admin = await prisma.user.findUnique({
    where: { walletAddress: SEEDED_ACCOUNTS.admin.address },
  });
  const ticket = await prisma.ticket.findFirst();
  await prisma.$disconnect();
  expect(user && admin, "seeded sample + admin users are required").toBeTruthy();

  const tokens: Record<Role, string> = {
    none: "",
    user: createToken(user!.id, SEEDED_CHAIN_ID),
    admin: createToken(admin!.id, SEEDED_CHAIN_ID),
  };

  const routes: RouteDef[] = [
    { path: "/", role: "none" },
    { path: "/login", role: "none" },
    { path: "/faq", role: "none" },
    { path: "/markets", role: "none" },
    { path: "/dashboard", role: "user" },
    { path: "/trade", role: "user" },
    { path: "/wallet", role: "user" },
    { path: "/history", role: "user" },
    { path: "/support", role: "user" },
    { path: "/admin", role: "admin" },
    { path: "/admin/webhooks", role: "admin" },
    ...(ticket ? [{ path: `/admin/tickets/${ticket.id}`, role: "admin" as Role }] : []),
    { path: "/markets?symbol=BTC&range=60&view=candles", role: "none", label: "/markets (candles)" },
    { path: "/markets?news=crypto", role: "none", label: "/markets (news filtered)" },
    { path: "/does-not-exist", role: "none", expect404: true },
    // The same routes with motion enabled: exercises the animated surfaces
    // (Phase 1–4 components) rather than the reduced-motion fallbacks. `/dashboard`
    // is signed in, so it also renders the longest nav (and the pill group at
    // desktop width) instead of the two-link signed-out bar.
    { path: "/", role: "none", label: "/ (motion)", motion: "no-preference" },
    { path: "/dashboard", role: "user", label: "/dashboard (motion)", motion: "no-preference" },
  ];

  const outDir = join(process.cwd(), "reports");
  const shotDir = join(outDir, "screenshots");
  mkdirSync(shotDir, { recursive: true });

  for (const vp of VIEWPORTS) {
    for (const route of routes) {
      const label = route.label || route.path;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: route.motion ?? "reduce",
      });
      if (route.role !== "none") {
        await context.addCookies([
          {
            name: "fin_session",
            value: tokens[route.role],
            domain: "127.0.0.1",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
      }

      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
      });
      page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 200)}`));

      const response = await page.goto(route.path, { waitUntil: "networkidle", timeout: 60_000 });
      const status = response ? response.status() : 0;
      checked.push({ viewport: vp.name, route: label, status });

      if (route.expect404) {
        if (status !== 404) findings.push({ kind: "console", viewport: vp.name, route: label, detail: `expected 404, got ${status}` });
      } else if (status >= 400) {
        findings.push({ kind: "console", viewport: vp.name, route: label, detail: `unexpected status ${status}` });
      }

      const overflow = await page.evaluate(detectOverflow);
      if (overflow.docOverflow > 1) {
        findings.push({
          kind: "overflow",
          viewport: vp.name,
          route: label,
          detail: `document overflows horizontally by ${overflow.docOverflow}px`,
        });
      }
      for (const o of overflow.offenders) {
        findings.push({
          kind: "overflow",
          viewport: vp.name,
          route: label,
          detail: `element ${o.sel} extends to ${o.right}px (width ${o.width}px) — "${o.text}"`,
        });
      }

      const contrast = await page.evaluate(detectContrast);
      for (const c of contrast) {
        findings.push({
          kind: "contrast",
          viewport: vp.name,
          route: label,
          detail: `${c.sel} "${c.text}" ${c.color} on ${c.bg} = ${c.ratio}:1 (needs ${c.required}) @ ${c.fontSize}px`,
        });
      }

      const liveRegions = await page.evaluate(detectNestedLiveRegions);
      for (const r of liveRegions) {
        findings.push({
          kind: "aria",
          viewport: vp.name,
          route: label,
          detail: `live region ${r.inner} is nested inside ${r.outer} — both announce, so the same change is read twice`,
        });
      }

      for (const e of Array.from(new Set(consoleErrors))) {
        // The 404 route legitimately requests a missing document; a missing
        // favicon must never be a finding either.
        if (route.expect404 && /404/.test(e)) continue;
        if (/favicon\.ico/i.test(e)) continue;
        findings.push({ kind: "console", viewport: vp.name, route: label, detail: e });
      }

      const slug = label.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
      await page.screenshot({ path: join(shotDir, `${vp.name}__${slug}.png`), fullPage: false });
      await context.close();
    }
  }

  /* ------------------------------------------------------------- artifacts */
  const byKind = (k: Finding["kind"]) => findings.filter((f) => f.kind === k);
  const lines: string[] = [];
  lines.push("# UI audit — overflow, contrast & live regions");
  lines.push("");
  lines.push(`- viewports: ${VIEWPORTS.map((v) => `${v.name} ${v.width}x${v.height}`).join(", ")}`);
  lines.push(`- pages checked: ${checked.length} (${routes.length} routes × ${VIEWPORTS.length} widths)`);
  lines.push(`- overflow findings: ${byKind("overflow").length}`);
  lines.push(`- contrast findings: ${byKind("contrast").length}`);
  lines.push(`- aria findings: ${byKind("aria").length}`);
  lines.push(`- console findings: ${byKind("console").length}`);
  lines.push("");
  lines.push("## Pages checked");
  lines.push("");
  lines.push("| Viewport | Route | Status |");
  lines.push("| --- | --- | --- |");
  for (const c of checked) lines.push(`| ${c.viewport} | \`${c.route}\` | ${c.status} |`);
  lines.push("");
  for (const kind of ["overflow", "contrast", "aria", "console"] as const) {
    const items = byKind(kind);
    lines.push(`## ${kind} findings (${items.length})`);
    lines.push("");
    if (!items.length) {
      lines.push("_None._");
    } else {
      lines.push("| Viewport | Route | Detail |");
      lines.push("| --- | --- | --- |");
      for (const f of items) lines.push(`| ${f.viewport} | \`${f.route}\` | ${f.detail.replace(/\|/g, "\\|")} |`);
    }
    lines.push("");
  }
  writeFileSync(join(outDir, "ui-audit.md"), lines.join("\n"));
  writeFileSync(join(outDir, "ui-audit.json"), JSON.stringify({ checked, findings }, null, 2));

  /* ------------------------------------------------------------- assertion */
  const summary = [
    `overflow=${byKind("overflow").length}`,
    `contrast=${byKind("contrast").length}`,
    `aria=${byKind("aria").length}`,
    `console=${byKind("console").length}`,
  ].join(" ");
  expect(findings, `UI audit findings (${summary}) — see reports/ui-audit.md:\n` +
    findings.slice(0, 25).map((f) => `- [${f.kind}] ${f.viewport} ${f.route}: ${f.detail}`).join("\n")
  ).toEqual([]);
});
