import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the Coinbase Onramp deposit action (`PHASE19-003`).
 *
 * The action is a real-money hand-off, so the properties that matter are structural:
 * it must produce nothing when Coinbase is unconfigured, refuse a practice session,
 * and only redirect to a Coinbase URL when everything is in place. Only the framework
 * boundary (next/headers, next/navigation, next/cache) and the SDK JWT helper are
 * mocked; the session verification and authz run for real against the throwaway DB.
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
    new Headers({ host: "localhost:3210", "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
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
import { startCoinbaseDepositAction } from "@/lib/actions";
import { ONRAMP_WIDGET_BASE } from "@/lib/coinbase/onramp";

const ADDRESS = `0x${"e1".repeat(20)}`;
const BASE_MAINNET = 8453;
const BASE_SEPOLIA = 84532;

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      walletAddress: ADDRESS,
      chainId: BASE_MAINNET,
      name: "Coinbase Deposit IT",
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
    await startCoinbaseDepositAction();
  } catch {
    /* the mocked redirect throws; the URL is asserted from h.redirects */
  }
}

describe("startCoinbaseDepositAction", () => {
  it("fails closed when Coinbase is not configured", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "");
    vi.stubEnv("CDP_API_KEY_SECRET", "");
    signInOn(BASE_MAINNET);

    await run();
    expect(h.redirects.at(-1)).toBe("/wallet?coinbase=unconfigured");
    expect(auth.generateJwt).not.toHaveBeenCalled();
  });

  it("redirects to the Coinbase onramp URL for a configured mainnet session", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "key-id");
    vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ token: "tok_it" }), { status: 200 }))
    );
    signInOn(BASE_MAINNET);

    await run();
    const target = h.redirects.at(-1)!;
    expect(target.startsWith(`${ONRAMP_WIDGET_BASE}?`)).toBe(true);
    expect(new URL(target).searchParams.get("sessionToken")).toBe("tok_it");
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
