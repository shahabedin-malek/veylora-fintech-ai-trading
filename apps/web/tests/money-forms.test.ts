import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard for the irreversibility control (`PHASE18-006`).
 *
 * Replay protection lives on the server: an action claims its idempotency key inside the
 * same transaction as the movement it guards, so a second submit with the *same* key is a
 * no-op. That guarantee is only worth anything if the form actually **carries** a key: a
 * form without one makes `idempotencyKeyFrom` mint a fresh key per submit, which silently
 * turns a double-click into two real movements.
 *
 * So this test pins the wiring rather than the mechanism:
 *
 *   1. The list of key-claiming actions is **derived from `actions.ts`** (the functions
 *      that call `idempotencyKeyFrom`), not hard-coded — so renaming or adding one keeps
 *      the guard honest instead of letting it check nothing.
 *   2. Every `<form>` in `src/` whose `action` is one of those must render a hidden
 *      `idempotencyKey` input.
 *
 * Forms that hand off to Coinbase's hosted on/offramp are deliberately exempt: they
 * produce a redirect to a provider-hosted flow and never move app-held funds, so they
 * claim no key (`startCoinbaseDepositAction`, `startCoinbaseWithdrawalAction`).
 */

const APP = process.cwd();
const SRC = join(APP, "src");
const ACTIONS = join(SRC, "lib", "actions.ts");

/** Forms whose action arrives as a prop; the real action is passed by the page. */
const DYNAMIC_ACTION_FILES = ["components/CoinbaseSwapForm.tsx"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Names of the server actions that claim an idempotency key, read from `actions.ts`. */
function keyClaimingActions(): string[] {
  const source = readFileSync(ACTIONS, "utf8");
  const starts = [...source.matchAll(/^export async function (\w+)/gm)];
  const names: string[] = [];
  starts.forEach((match, i) => {
    const from = match.index!;
    const to = i + 1 < starts.length ? starts[i + 1].index! : source.length;
    const body = source.slice(from, to);
    if (body.includes("idempotencyKeyFrom(")) names.push(match[1]);
  });
  return names;
}

interface FoundForm {
  file: string;
  action: string;
  hasKey: boolean;
}

/** Every `<form …>…</form>` in `src/`, with the action it submits to. */
function forms(): FoundForm[] {
  const out: FoundForm[] = [];
  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<form\b[\s\S]*?<\/form>/g)) {
      const block = match[0];
      const action = /action=\{(\w+)\}/.exec(block)?.[1];
      if (!action) continue;
      out.push({
        file: file.slice(SRC.length + 1),
        action,
        hasKey: /name="idempotencyKey"/.test(block),
      });
    }
  }
  return out;
}

describe("money forms carry an idempotency key", () => {
  const moneyActions = keyClaimingActions();
  const all = forms();

  it("finds the key-claiming actions and the forms that submit them", () => {
    // Guards against a silently empty match on either side.
    expect(moneyActions.length, "key-claiming actions found in actions.ts").toBeGreaterThan(1);
    expect(all.length, "forms found in src/").toBeGreaterThan(3);
  });

  it("gives every form submitting a key-claiming action a hidden idempotencyKey", () => {
    const checked = all.filter((form) => moneyActions.includes(form.action));
    expect(checked.length, `forms submitting ${moneyActions.join(", ")}`).toBeGreaterThan(1);

    const missing = checked.filter((form) => !form.hasKey).map((form) => `${form.file}: ${form.action}`);
    expect(missing, "money forms without a hidden idempotencyKey input").toEqual([]);
  });

  it("keeps the dynamic-action form (client component) carrying a key", () => {
    for (const rel of DYNAMIC_ACTION_FILES) {
      const source = readFileSync(join(SRC, rel), "utf8");
      expect(source, `${rel}: hidden idempotencyKey input`).toContain('name="idempotencyKey"');
    }
  });

  it("does not require a key on provider hand-off forms, which claim none", () => {
    const handoff = ["startCoinbaseDepositAction", "startCoinbaseWithdrawalAction"];
    expect(moneyActions.filter((a) => handoff.includes(a)), "hand-off actions must stay key-free").toEqual([]);
  });
});
