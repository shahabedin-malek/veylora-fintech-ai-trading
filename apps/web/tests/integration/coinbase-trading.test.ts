import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the real Coinbase swap action (`PHASE19-004`).
 *
 * Only the framework boundary and the CDP SDK are mocked; session verification and
 * authz run for real against the throwaway DB. The properties are structural: a
 * practice session, the kill switch, a mismatched pair and a bad pair all refuse, and
 * a fully-configured mainnet swap writes a real transaction record.
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
  headers: async () => new Headers({ host: "localhost:3210" }),
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

const sdk = vi.hoisted(() => ({
  getSwapPrice: vi.fn(),
  createSwapQuote: vi.fn(),
  getOrCreateAccount: vi.fn(async () => ({
    address: "0x00000000000000000000000000000000000000aa" as const,
    sign: vi.fn(),
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
  })),
}));

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: class {
    evm = {
      getOrCreateAccount: sdk.getOrCreateAccount,
      getSwapPrice: sdk.getSwapPrice,
      createSwapQuote: sdk.createSwapQuote,
    };
  },
}));

import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createToken } from "@/lib/session";
import { startCoinbaseSwapAction } from "@/lib/actions";

const ADDRESS = `0x${"a7".repeat(20)}`;
const BASE_MAINNET = 8453;
const ETHEREUM_MAINNET = 1;
const BASE_SEPOLIA = 84532;

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      walletAddress: ADDRESS,
      chainId: BASE_MAINNET,
      name: "Coinbase Trading IT",
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
  sdk.getSwapPrice.mockReset();
  sdk.createSwapQuote.mockReset();
  sdk.getOrCreateAccount.mockClear();
  h.redirects.length = 0;
  h.store.clear();
});

function signInOn(chainId: number) {
  h.store.set(SESSION_COOKIE, createToken(userId, chainId));
}

/**
 * Custody + CDP credentials, so the gate and the adapter's own checks pass. Real
 * execution is on by default, so no opt-in flag is needed (the kill switch is tested
 * separately).
 */
function enableRealTrading() {
  vi.stubEnv("MAINNET_EXECUTION_ENABLED", ""); // default: enabled
  vi.stubEnv("CUSTODY_PROVIDER", "coinbase-cdp");
  vi.stubEnv("CUSTODY_KEY_ID", "hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
  vi.stubEnv("CDP_WALLET_SECRET", "wallet-secret");
}

function swapForm(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("confirm", "on");
  fd.set("idempotencyKey", crypto.randomUUID());
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function run(form: FormData): Promise<void> {
  try {
    await startCoinbaseSwapAction(form);
  } catch {
    /* the mocked redirect throws; the URL is asserted from h.redirects */
  }
}

describe("startCoinbaseSwapAction", () => {
  it("refuses when the kill switch is set, even with custody configured", async () => {
    enableRealTrading();
    vi.stubEnv("MAINNET_EXECUTION_ENABLED", "0");
    signInOn(BASE_MAINNET);
    await run(swapForm({ pair: "base-usdc-eth", amount: "10" }));
    expect(h.redirects.at(-1)).toBe("/trade?coinbase=disabled");
    expect(sdk.createSwapQuote).not.toHaveBeenCalled();
  });

  it("refuses a pair that is on a different chain than the session", async () => {
    enableRealTrading();
    signInOn(ETHEREUM_MAINNET); // base-usdc-eth is chainId 8453
    await run(swapForm({ pair: "base-usdc-eth", amount: "10" }));
    expect(h.redirects.at(-1)).toBe("/trade?coinbase=network");
    expect(sdk.createSwapQuote).not.toHaveBeenCalled();
  });

  it("refuses an unrecognised pair", async () => {
    enableRealTrading();
    signInOn(BASE_MAINNET);
    await run(swapForm({ pair: "not-a-pair", amount: "10" }));
    expect(h.redirects.at(-1)).toBe("/trade?coinbase=invalid");
  });

  it("writes nothing without the explicit confirmation", async () => {
    enableRealTrading();
    signInOn(BASE_MAINNET);
    const form = swapForm({ pair: "base-usdc-eth", amount: "10" });
    form.set("confirm", "");
    await run(form);
    expect(sdk.createSwapQuote).not.toHaveBeenCalled();
    const count = await prisma.transaction.count({ where: { userId, kind: "TRADE" } });
    expect(count).toBe(0);
  });

  it("executes a configured mainnet swap and records it", async () => {
    enableRealTrading();
    signInOn(BASE_MAINNET);
    const execute = vi.fn(async () => ({ transactionHash: "0xswap123" }));
    sdk.createSwapQuote.mockResolvedValue({ liquidityAvailable: true, execute });

    await run(swapForm({ pair: "base-usdc-eth", amount: "10" }));

    expect(h.redirects).toEqual([]);
    expect(execute).toHaveBeenCalled();
    const tx = await prisma.transaction.findFirst({ where: { userId, kind: "TRADE" }, orderBy: { createdAt: "desc" } });
    expect(tx?.detail).toContain("0xswap123");
    // 10 USDC at a $1 peg = $10.00 notional.
    expect(tx?.amountCents).toBe(1000);
  });
});
