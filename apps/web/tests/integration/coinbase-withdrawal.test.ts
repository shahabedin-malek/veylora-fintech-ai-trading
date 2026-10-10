import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the Coinbase Offramp withdrawal action (`PHASE19-005`).
 *
 * Same structural properties as the deposit hand-off: nothing when unconfigured, a
 * refusal for a practice session, and a Coinbase URL only when everything is in place.
 * Only the framework boundary and the SDK JWT helper are mocked; session verification
 * and authz run for real against the throwaway DB.
 */

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  redirects: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.store.has(name) ? { name, value: h.store.get(name)! } : undefined),
    set: (name: string, value: string) => {
      h.store.set(name, value);
    },
    delete: (name: string) => {
      h.store.delete(name);
    },
  }),
  headers: async () =>
    new Headers({
      host: "localhost:3210",
      "x-forwarded-for": "203.0.113.7",
      "x-forwarded-proto": "https",
    }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.redirects.push(url);
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const auth = vi.hoisted(() => ({ generateJwt: vi.fn(async () => "jwt-token") }));
vi.mock("@coinbase/cdp-sdk/auth", () => ({ generateJwt: auth.generateJwt }));

import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createToken } from "@/lib/session";
import { startCoinbaseWithdrawalAction } from "@/lib/actions";
import { OFFRAMP_WIDGET_BASE } from "@/lib/coinbase/offramp";

const ADDRESS = `0x${"f2".repeat(20)}`;
const BASE_MAINNET = 8453;
const BASE_SEPOLIA = 84532;

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      walletAddress: ADDRESS,
      chainId: BASE_MAINNET,
      name: "Coinbase Withdrawal IT",
      wallet: { create: { address: ADDRESS, kind: "MAINNET", network: "mainnet" } },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  auth.generateJwt.mockClear();
  h.redirects.length = 0;
  h.store.clear();
});

function signInOn(chainId: number) {
  h.store.set(SESSION_COOKIE, createToken(userId, chainId));
}

async function run(): Promise<void> {
  try {
    await startCoinbaseWithdrawalAction();
  } catch {
    /* the mocked redirect throws; the URL is asserted from h.redirects */
  }
}

describe("startCoinbaseWithdrawalAction", () => {
  it("fails closed when Coinbase is not configured", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "");
    vi.stubEnv("CDP_API_KEY_SECRET", "");
    signInOn(BASE_MAINNET);

    await run();
    expect(h.redirects.at(-1)).toBe("/wallet?coinbase=unconfigured");
    expect(auth.generateJwt).not.toHaveBeenCalled();
  });

  it("redirects to the Coinbase offramp URL for a configured mainnet session", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "key-id");
    vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ token: "tok_off" }), { status: 200 }))
    );
    signInOn(BASE_MAINNET);

    await run();
    const target = h.redirects.at(-1)!;
    expect(target.startsWith(`${OFFRAMP_WIDGET_BASE}?`)).toBe(true);
    const q = new URL(target).searchParams;
    expect(q.get("sessionToken")).toBe("tok_off");
    // The required redirect returns the user to the wallet page.
    expect(q.get("redirectUrl")).toBe("https://localhost:3210/wallet?coinbase=offramp");
  });

  it("bounces back to /wallet when Coinbase cannot start a session", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "key-id");
    vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    signInOn(BASE_MAINNET);

    await run();
    expect(h.redirects.at(-1)).toBe("/wallet?coinbase=error");
  });
});
