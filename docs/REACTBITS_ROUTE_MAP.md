# React Bits — Component Audit & Route Fit Map

Status: **audit + implementation done through Phase 4.** Phase 1 (`Counter` KPIs,
`RubberSegment` markets toggles, `AnimatedList` feeds, `MagicBento` feature grid),
Phase 2 (the `WarpText` hero headline and `SpecularButton` primary CTA), Phase 3 (the
AI-desk trade terminal) and Phase 4 (the `PillNav` + `StaggeredMenu` header) are all
implemented. The whole app passes the Playwright UI audit (overflow / contrast /
nested live regions / console at 3 widths, on both the reduced-motion fallbacks and
the animated markup).
What remains below is the optional/deferred set.

Source: `reactbits.dev.md` (22,284 lines, ~670 KB) — a concatenation of 45
integration prompts: **43 named components** plus 2 blocks the generator could not
name (`ThoughtLine`, `PromptBar` — see the appendix).

## How this audit was produced

- Parsed the export programmatically rather than reading it end to end
  (`scripts/reactbits_extract.py --list`), so the inventory is exhaustive and
  reproducible instead of eyeballed.
- For every component: captured its dependency, its usage example and props to
  infer intent, and compared that against the **current** code of each route
  (`apps/web/src/app/**/page.tsx`) and the installed dependency set
  (`apps/web/package.json`).
- "Best-fit route" is a judgement call about where the component's *effect* solves
  a real presentational need — not an invitation to use all 43. Components whose
  only use would be decoration are marked to skip.

## Dependency status

Installed today (`apps/web/package.json`): `ogl@^1.0.11`, `gsap@^3.15`,
`@gsap/react@^2.1.2`, `motion@^14`, and — added for Phase 3 —
`@hugeicons/react@^1.1.10` + `@hugeicons/core-free-icons@^4.3.5`. Only one package
is still missing:

| Missing package | Needed by | Cost |
| --- | --- | --- |
| `lenis` | `ScrollStack` | one small scroll library |

Everything else (component deps `none`, `ogl`, `gsap`, `motion`, `@hugeicons/*`) is
ready to extract with no new install.

## Already integrated (20 of 43)

Extracted by `scripts/reactbits_extract.py` into
`apps/web/src/components/reactbits/`, and every row below is wired into the UI:

| Component | Route | Mounted by | Guard |
| --- | --- | --- | --- |
| `SplitText` | `/` | `AnimatedText` | `usePrefersReducedMotion()` |
| `WarpText` | `/` | `HeroHeadline` | `useBackdropAllowed()` (motion + WebGL), real `<h1>` alongside |
| `Counter` | `/`, `/dashboard`, `/admin` | `page.tsx`, `KpiAmount`, `KpiCount` | `MotionProvider` (`reducedMotion="user"`) |
| `GlareHover` | `/` | `page.tsx` | hover-only |
| `LogoLoop` | `/` | `page.tsx` | CSS marquee |
| `SpotlightCard` | `/wallet`, `/history`, `/support` | page cards | pointer-only |
| `StarBorder` | `/` | `SpecularCta` (fallback), `page.tsx` | CSS |
| `SpecularButton` | `/` | `SpecularCta` | `useBackdropAllowed()` (motion + WebGL) |
| `Stepper` | `/` | `page.tsx` | `MotionProvider` |
| `ClickSpark` | global | `ClickSparkLayer` | `useMotionAllowed()` |
| `LatticeLoader` | loading | `app/loading.tsx` | `role="status"` |
| `StatusMark` | `/trade` | `TradingTerminal` | `useReducedMotion` |
| `ThoughtLine` | `/trade` | `TradingTerminal` | `useReducedMotion` |
| `CallChip` | `/trade` | `TradingTerminal` | `prefers-reduced-motion` |
| `AnimatedList` | `/dashboard`, `/markets`, `/admin` | page feeds | `useInView` |
| `RubberSegment` | `/markets` | `MarketsControls` | `useReducedMotion` |
| `MagicBento` | `/` | `FeatureBento` | `usePrefersReducedMotion()` |
| `BorderGlow` | `/wallet`, `/trade`, `/support` | page cards | hover-driven |
| `PillNav` | global (≥901px) | `AppNav` | `usePrefersReducedMotion()` |
| `StaggeredMenu` | global (≤900px) | `AppNav` | `usePrefersReducedMotion()` |

## Full inventory (43 named components)

Legend — **Fit**: ✅ recommended · ➕ optional (decorative/nice-to-have) ·
⛔ not recommended. **Deps**: ✅ available · ⚠️ needs install.

| Component | Deps | Fit | Effect | Best-fit route |
| --- | --- | --- | --- | --- |
| `WarpText` | `ogl` ✅ | ✅ | WebGL glass-warped headline, pointer lensing *(in use)* | **Landing** hero title |
| `DepthText` | none ✅ | ➕ | Layered 3D extruded text, pointer orbit | Landing / section headings |
| `FoldText` | `gsap` ✅ | ✅ | Scroll/click fold-in split text | Landing section headings |
| `SplitText` | `gsap` ✅ | ✅ | Per-char/word reveal *(in use)* | Landing + any heading |
| `TextType` | `gsap` ✅ | ➕ | Typewriter with cursor | Landing badge / Login lede |
| `CrystalizedBall` | `ogl` ✅ | ➕ | WebGL crystal ball with electric strands | Landing (one hero effect only) |
| `GlowCursor` | `ogl` ✅ | ➕ | WebGL glowing cursor trail | Global cursor |
| `ScrollExpand` | none ✅ | ✅ | Scroll-driven expanding media frame | Landing hero media / feature reveal |
| `PixelSwap` | none ✅ | ➕ | Click-to-swap content in a pixel grid | Landing easter egg |
| `CursorGrid` | none ✅ | ➕ | Grid lights up under the cursor | Markets chart backdrop |
| `GlareHover` | none ✅ | ✅ | Glare sweep on hover *(in use)* | Cards everywhere |
| `LogoLoop` | none ✅ | ✅ | Infinite logo/node marquee *(in use)* | Landing provider strip |
| `TargetCursor` | `gsap` ✅ | ➕ | Custom cursor that snaps to targets | Global cursor |
| `MagicRings` | none ✅ | ➕ | Animated concentric rings | Landing / error page |
| `ClickSpark` | none ✅ | ✅ | Spark burst on click *(in use)* | Global |
| `Strands` | `ogl` ✅ | ➕ | WebGL flowing coloured strands | Landing (decorative) |
| `StarBorder` | none ✅ | ✅ | Animated star border on CTA *(in use)* | Landing / Wallet / Login CTAs |
| `SpecularButton` | `ogl` ✅ | ✅ | WebGL specular-lit primary button *(in use)* | Landing / Login primary CTA |
| `AnimatedList` | `motion` ✅ | ✅ | Selectable animated list, gradients + arrow nav **(in use)** | Markets news · Dashboard notifications · Admin audit · Support tickets · History |
| `ScrollStack` | `lenis` ⚠️ | ➕ | Sticky stacked cards on scroll | Landing "how it works" |
| `MagicBento` | `gsap` ✅ | ✅ | Bento grid with spotlight/tilt/stars **(in use)** | Landing features grid |
| `CardNav` | `gsap` ✅ | ➕ | Expanding card dropdown nav | Global nav |
| `PillNav` | `gsap` ✅ | ✅ | Pill nav with hover indicator *(in use)* | **Global nav** (desktop) |
| `StaggeredMenu` | `gsap` ✅ | ✅ | Full-screen staggered menu *(in use)* | **Global nav** (mobile drawer) |
| `GooeyNav` | none ✅ | ✅ | Gooey blob nav with particles | Global nav / Admin section tabs |
| `PixelCard` | none ✅ | ➕ | Pixelated reveal on hover | Markets instrument cards |
| `SpotlightCard` | none ✅ | ✅ | Cursor spotlight card *(in use)* | Cards on every route |
| `BorderGlow` | none ✅ | ✅ | Edge-tracking glow border on a container **(in use)** | Wallet · Trade · Support cards |
| `Counter` | `motion` ✅ | ✅ | Digit-roll counter *(in use)* | **Dashboard KPIs** · Admin KPIs · Markets stats |
| `Stepper` | `motion` ✅ | ✅ | Multi-step wizard *(in use)* | Landing "how it works" · onboarding |
| `ThoughtLine`* | `motion`+hugeicons ✅ | ✅ | "Thinking…" agent step line **(in use)** | **Trade** terminal |
| `PromptBar`* | `motion`+hugeicons ✅ | ➕ | Prompt input with attachments/model/effort | Trade / Support |
| `CallChip` | hugeicons ✅ | ✅ | Terminal tool-call chip (name, arg, status) **(in use)** | **Trade** activity stream · Admin ticket chips |
| `StatusMark` | `motion` ✅ | ✅ | Status icon + progress ring (run/done/error) | **Trade** session state · Admin/Support ticket state |
| `GlideSelect` | hugeicons ✅ | ✅ | Animated select dropdown with tags | Markets range/view · Admin status/priority · Support |
| `JellyRadio` | `motion` ✅ | ➕ | Jelly segmented chips | Dashboard/Markets/FAQ toggles |
| `CodeSlots` | `motion`+hugeicons ✅ | ⛔ | OTP-style code entry | — (no OTP flow in the app) |
| `LatticeLoader` | none ✅ | ✅ | Animated loader with status/timer *(in use)* | Loading · Trade "thinking" |
| `SlideCommit` | `motion`+hugeicons ✅ | ✅ | Slide-to-confirm control | **Wallet** withdraw · Trade stop |
| `RubberSegment` | `motion` ✅ | ✅ | Rubbery segmented control **(in use)** | **Markets** range/view · Dashboard |
| `GhostFibers` | `ogl` ✅ | ⛔ | WebGL ghostly fibre field | — (heaviest, least legible) |
| `GradientWaves` | `ogl` ✅ | ➕ | WebGL gradient waves | Landing backdrop (alternative to Aurora) |
| `DarkVeil` | `ogl` ✅ | ➕ | Dark WebGL veil backdrop | Landing / Login backdrop |
| `Aurora` | `ogl` ✅ | ➕ | Aurora backdrop | Landing / login backdrop — extracted but currently **unmounted**; `WarpText` took the hero surface |
| `Plasma` | `ogl` ✅ | ➕ | Plasma field backdrop | Landing backdrop (mouse-reactive) |

\* `ThoughtLine` and `PromptBar` are the two blocks the export left unnamed; they
are listed here for completeness but are **not** part of the 43 named components.

## Per-route map

### `/` Landing (`page.tsx`)

Currently: `WarpText` hero headline (falling back to the animated `<h1>` for
reduced motion / no WebGL) + `SpecularButton` primary CTA → stat band (`Counter`) →
market snapshot (`GlareHover`) → feature grid (`MagicBento`) → provider marquee
(`LogoLoop`) → how-it-works (`Stepper`) → CTA (`StarBorder`).

**Done (Phase 2):** `WarpText` replaced the hero `<h1>` and the `Aurora` backdrop,
and `SpecularButton` replaced the primary CTA's `StarBorder`. The hero therefore has
exactly one hero-scale WebGL surface (see guardrail 1); both components fall back to
the previous markup when motion is unwelcome or WebGL is unavailable.

- **Recommended:** `MagicBento` (replace the plain feature grid), `ScrollExpand`
  (hero media frame), `BorderGlow` (CTA card), `GooeyNav`/`PillNav` (nav, see
  Global), `AnimatedList` (feature list alternative), `FoldText` (section headings).
- **Done:** `WarpText`, `SpecularButton` (Phase 2); `MagicBento`, `Counter`,
  `AnimatedList` (Phase 1).
- **Optional:** `DarkVeil` / `GradientWaves` / `Plasma` (only if the hero surface is
  freed up again — never stack WebGL canvases), `TextType` (badge), `DepthText`,
  `ScrollStack` (needs `lenis`), `PixelCard`, `PixelSwap`, `MagicRings`.
- **Skip:** `Strands`, `GhostFibers`, `CrystalizedBall` — decorative WebGL that
  competes with the hero and costs GPU.

### `/dashboard` (`dashboard/page.tsx`)

Currently: greeting → three KPI cards (balance, P/L, withdrawable) → controls →
market table + notifications.

- **Recommended:** `Counter` for the three KPI numbers (currently static
  `formatUsd` strings), `AnimatedList` for the notifications feed, `StatusMark`
  mirroring the trading-state machine (`controls.state`) next to Controls,
  `BorderGlow`/`SpotlightCard` on the KPI cards.
- **Optional:** `RubberSegment` for a snapshot range toggle, `GlideSelect` for a
  table view selector, `LatticeLoader` while a control action is in flight.
- **Skip:** cursor and backdrop effects — this is an app surface, not a hero.

### `/markets` (`markets/page.tsx`)

Currently: range toggles and view toggles are plain `Link`s (full navigation),
custom `PriceChart`, instruments table, news list.

- **Recommended:** `RubberSegment` or `GlideSelect` for the **range** (24h/7d/14d)
  and **view** (line/area/candles) toggles — the clearest fit in the whole audit,
  since these are already conceptual segmented controls rendered as buttons.
  `AnimatedList` for the news feed.
- **Optional:** `GlareHover`/`SpotlightCard`/`BorderGlow` on the chart and news
  cards, `Counter` for the 24h stats, `PixelCard` for an instrument card grid,
  `CursorGrid` as a faint chart backdrop.
- **Caveat:** converting the toggles to a client control means the currently
  server-rendered `searchParams` nav becomes client state (or a wrapper that keeps
  the URL in sync). Budget for that, and keep the `Link`-based fallback for
  no-JS/progressive enhancement.

### `/trade` (`trade/page.tsx`)

Currently: controls → three KPIs → `TradingTerminal` activity stream.

- **Recommended — the strongest cluster in the file:** `CallChip` (render each
  terminal event as a tool-call chip), `StatusMark` (running/idle/error
  session state), `ThoughtLine` (the "AI is thinking" line while active),
  `LatticeLoader` (reuse the loading lattice in the terminal), `AnimatedList` (the
  event stream). This is exactly the "AI agent desk" the product claims to be.
- **Optional:** `SlideCommit` for start/stop confirmation, `GlideSelect` for the
  strategy selector, `Counter` for P/L, `PromptBar` as a command input.
- **Cost:** the whole `CallChip`/`ThoughtLine`/`GlideSelect` family needs the two
  `@hugeicons/*` packages installed.

### `/admin` (+ `admin/tickets/[id]`)

Currently: three KPI cards → tickets table → customers table + audit log; ticket
detail has a conversation and a triage form built on native `<select>`s.

- **Recommended:** `Counter` for the KPI tiles, `AnimatedList` for the audit log
  and ticket list, `StatusMark` for ticket/priority state, `GlideSelect` for the
  status/priority/assignee selects (replacing native selects), `GooeyNav` for
  section tabs (Tickets / Customers / Audit), `CallChip` for ticket numbers.
- **Optional:** `BorderGlow`/`SpotlightCard` on console cards.
- **Caveat:** the triage form posts to `adminUpdateTicketAction`; any custom
  select must still submit the same named field values, so wrap it carefully.

### Secondary routes

| Route | Recommended | Optional | Skip |
| --- | --- | --- | --- |
| `/wallet` | `SlideCommit` for the withdraw confirm, `BorderGlow` cards, `Counter` for the balance | `RubberSegment` quick-amount presets, `StarBorder` on the withdraw CTA | backdrop effects |
| `/login` | `SpecularButton`/`StarBorder` CTA, `SpotlightCard`/`BorderGlow` card | `DarkVeil` backdrop, `TextType` lede, `WarpText` heading | heavy WebGL |
| `/support` | `AnimatedList` for the ticket list, `StatusMark` for ticket state, `CallChip` ticket-number chips | `GlideSelect` priority filter, `BorderGlow` cards | cursor effects |
| `/history` | `AnimatedList` for transactions/ledger rows, `Counter` for totals | `BorderGlow` cards | — |
| `/faq` | `GooeyNav` category filter, `SpotlightCard`/`BorderGlow` accordions | `TextType` intro | — |
| Global (nav) | **Done:** `PillNav` (≥901px) + `StaggeredMenu` (≤900px), swapped in by `AppNav` | `CardNav`, `GooeyNav` | stacking a third nav |
| Global (cursor) | one of `TargetCursor` (gsap) or `GlowCursor` (ogl), gated on motion | — | stacking both |
| Global (chrome) | `LatticeLoader` (in use), `MagicRings` on error/404 | `ClickSpark` (in use) | — |

### Global header (`components/Nav.tsx` → `components/AppNav.tsx`)

The header is server-resolved and client-presented. `Nav` (server) looks up the
visitor, builds the link list as plain data, and renders the account control — the
sign-out form posts to a server action, so it is built on the server and passed down
as an element (a function would not cross the boundary). `AppNav` (client) picks the
presentation, and the vendored navs bring their own quirks, all handled in the
`.nav-enhanced` block in `globals.css`:

- `PillNav` is a floating pill group for a hero: its container is made `static` so it
  sits in the bar, its image-only logo is hidden because the bar already links the
  brand home, and `.pill-label-hover` gets an `opacity: 0` default because GSAP is
  what normally hides it (otherwise the first paint is two labels on top of each
  other). Its `menubar`/`menuitem` roles were removed — those describe an
  application menu and hide the links' real `link` role.
- `StaggeredMenu` is a full-viewport drawer: only its toggle is placed in the bar,
  its own logo and 2em header padding are dropped, and its panel and underlay are
  pinned to the viewport. The toggle out-ranks the panel by `z-index` so it can close
  it. The panel is `inert` while closed, because the export only translates it
  off-screen — without that its links stay in the tab order inside an `aria-hidden`
  subtree.
- It slides in from the **left** (`position="left"`): the closed panel then sits at
  `x ∈ [-width, 0]`, entirely off-screen, so it adds no document overflow. Sliding
  from the right would park it at `[vw, vw + width]`, which the UI audit correctly
  reports as an element extending past the viewport.
- The breakpoint is **900px**, not PillNav's own 768px: a signed-in admin has seven
  pills, and 900px is the first width where that group plus the brand and the account
  control all fit without shrinking. Below it the drawer takes over.

**Without JS.** The desktop pills are ordinary anchors and still work, but the drawer
does not: its panel is revealed by GSAP and stays `inert` until opened. A `<noscript>`
row (`AppNav` → `.nav-nojs`) therefore carries the links where the drawer would have
been. It is only shown below the breakpoint — above it the pills already work — and it
is a horizontally scrolling row, so it cannot widen the page however many links a
signed-in admin has. `@media (scripting: none)` hides the now-dead drawer toggle in
that case. Verified with scripting actually disabled: 375px and 768px show the links
with no horizontal overflow, 1440px falls through to the pills.

One thing to know if this ever regresses into a hydration error: React renders
`<noscript>` children, and a browser with scripting on parses them as **text**, so
those children are deliberately *not* hydrated — they must not depend on any client
state that differs from the server render.

### Live regions on `/trade`

The activity stream is a single `role="log" aria-live="polite"` region, and the log
announces each line as it is added. `CallChip` is its own `role="status"` region by
default, which was a second live region inside the log — every event was announced
twice. The terminal now passes `live={false}`, so the chips are ordinary content
(their visible text is `aria-hidden` and each chip carries one screen-reader string)
and the log is the only announcer. `ThoughtLine` keeps its own `role="status"` for the
thinking/settled state: that is a sibling of the log, not inside it, and it says
something the log does not.

This is now a checked invariant rather than a one-off fix: the UI audit walks every
live region on every audited page and fails if one sits inside another
(`detectNestedLiveRegions` in `tests/e2e/ui-audit.spec.ts`). It reports `aria
findings`, and it was confirmed to flag the original shape — a `role="status"` inside
the log — rather than passing vacuously.

## Guardrails (apply to any implementation)

1. **One WebGL surface per page.** `Aurora`, `Plasma`, `DarkVeil`,
   `GradientWaves`, `Strands`, `WarpText`, `CrystalizedBall`, `GlowCursor`,
   `SpecularButton` all create a canvas/GL context. Gate each with
   `useBackdropAllowed()`; do not mount two backdrop-scale surfaces on one route.
   On `/` the hero budget is one surface and `WarpText` owns it, which is why the
   `Aurora` backdrop was retired from that route rather than stacked underneath. A
   component's own small chrome canvas (e.g. `SpecularButton`'s rim light) is not a
   backdrop and may sit alongside it — but the pattern to check is a *full-bleed*
   shader, not the context count.
2. **Motion is opt-in.** Text components (`SplitText`, `FoldText`, `TextType`,
   `WarpText`) animate from `opacity: 0`. Every one needs a reduced-motion branch
   like `AnimatedText` already provides, or the headline disappears for users who
   asked for no motion.
3. **Preserve accessibility semantics.** Keep `role="status"`/live regions for
   loaders, keep native `<select>`/checkbox fallbacks (a11y + form submission),
   and keep focus order. The `e2e/ui-audit` spec exists for a reason.
4. **Client/server boundary.** The app pages are server components. Custom
   controls (`RubberSegment`, `GlideSelect`, `SlideCommit`, `AnimatedList`) must
   be isolated `'use client'` leaves, fed by server data, not converted wholesale.
5. **Bundle discipline.** Extract lazily; prefer components with `deps: none`
   where the visual result is close, and don't add `lenis`/`@hugeicons/*` for a
   single decorative use.

## Recommended rollout

- **Phase 1 — no new deps (done):** `Counter` on Dashboard/Admin KPIs,
  `RubberSegment` for Markets range/view, `AnimatedList` for Markets news +
  Dashboard notifications + Admin audit, `MagicBento` on the Landing feature grid
  (replacing the `SpotlightCard` grid), and `BorderGlow`/`SpotlightCard` on the
  Wallet, History, Support and Trade cards.
- **Phase 2 — hero upgrade (done):** `WarpText` on the Landing `<h1>` (with the
  `SplitText`/`AnimatedText` headline kept as the reduced-motion and no-WebGL
  fallback, and a real `<h1>` retained for semantics/SEO), `SpecularButton` CTA
  (falling back to `StarBorder`).
- **Phase 3 — the AI-desk story (done):** `@hugeicons/*` installed; `CallChip` +
  `StatusMark` + `ThoughtLine` now drive the Trade terminal (`LatticeLoader` was
  already in use for route loading).
- **Phase 4 — nav (done):** `PillNav` for the desktop link group and
  `StaggeredMenu` for the mobile drawer, both mounted by `AppNav` only when motion is
  welcome; the reduced-motion branch (and the no-JS server render order) keeps the
  original plain link row.
- **Defer/skip:** `ScrollStack` (`lenis`), `CodeSlots`, `GhostFibers`, heavy
  decorative backdrops beyond the one hero.

## Appendix — implementation checklist

- Tick only when the component is extracted, wired, gated and reviewed.
- [x] Phase 1 components
- [x] Phase 2 hero components (`WarpText`, `SpecularButton`)
- [x] Phase 3 terminal components (`CallChip`, `StatusMark`, `ThoughtLine`)
- [x] Phase 4 navigation components (`PillNav`, `StaggeredMenu`)
- [x] Confirm each new surface answers "does the visitor want motion / can this
      device render it" via `lib/motion.ts`
- [x] Re-run `npm run typecheck && npm test` and `npm run test:ui-audit`
