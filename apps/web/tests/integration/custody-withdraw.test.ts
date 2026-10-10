import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the on-chain custody withdrawal (`PHASE18-005`).
 *
 * Only the framework boundary, the CDP SDK and the market quote are mocked; session
 * verification and authz run for real against the throwaway DB. The properties are
 * structural: a practice session, the kill switch and a bad address all refuse, and a
 * fully-configured mainnet withdrawal sends through the custody signer, records the
 * movement, and writes both the ledger and the audit trail.
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

vi.mock("@/lib/market", () => ({
  getQuotesSafe: async () => ({
    quotes: [{ symbol: "ETH", priceUsd: 2000, offline: false }],
  }),
}));

const sdk = vi.hoisted(() => ({
  getOrCreateAccount: vi.fn(async () => ({
    address: "0x00000000000000000000000000000000000000bb" as const,
    sign: vi.fn(),
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
  })),
  sendTransaction: vi.fn(async () => ({ transactionHash: "0xwithdraw123" as const })),
}));

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: class {
    evm = {
      getOrCreateAccount: sdk.getOrCreateAccount,
      sendTransaction: sdk.sendTransaction,
    };
  },
}));

import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createToken } from "@/lib/session";
import { startOnChainWithdrawalAction } from "@/lib/actions";

const ADDRESS = `0x${"c3".repeat(20)}`;
const BASE_MAINNET = 8453;
const BASE_SEPOLIA = 84532;
const DEST = `0x${"1a".repeat(20)}`;

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      walletAddress: ADDRESS,
      chainId: BASE_MAINNET,
      name: "Custody Withdraw IT",
      wallet: { create: { address: ADDRESS, kind: "MAINNET", network: "mainnet" } },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
});

/**
 * Prisma auto-loads `.env`, which in a dev checkout may hold real CDP/custody
 * credentials. Clear them (and the kill switch) before every test so each one starts
 * from a known, unconfigured state and opts in explicitly via `enableCustody()`.
 */
beforeEach(() => {
  for (const name of [
    "CUSTODY_PROVIDER",
    "CUSTODY_KEY_ID",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
    "MAINNET_EXECUTION_ENABLED",
    "COMPLIANCE_PROVIDER",
  ]) {
    vi.stubEnv(name, "");
  }
});

afterEach(async () => {
  vi.unstubAllEnvs();
  sdk.sendTransaction.mockClear();
  sdk.getOrCreateAccount.mockClear();
  h.redirects.length = 0;
  h.store.clear();
  await prisma.custodySpend.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { actorId: userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.idempotencyKey.deleteMany({ where: { userId } });
});

function signInOn(chainId: number) {
  h.store.set(SESSION_COOKIE, createToken(userId, chainId));
}

function enableCustody() {
  vi.stubEnv("MAINNET_EXECUTION_ENABLED", ""); // default: enabled
  vi.stubEnv("CUSTODY_PROVIDER", "coinbase-cdp");
  vi.stubEnv("CUSTODY_KEY_ID", "hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
  vi.stubEnv("CDP_WALLET_SECRET", "wallet-secret");
}

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("confirm", "on");
  fd.set("idempotencyKey", crypto.randomUUID());
  fd.set("to", DEST);
  fd.set("amount", "0.1");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function run(fd: FormData): Promise<void> {
  try {
    await startOnChainWithdrawalAction(fd);
  } catch {
    /* the mocked redirect throws; the URL is asserted from h.redirects */
  }
}

describe("startOnChainWithdrawalAction", () => {
  it("refuses when the kill switch is set, even with custody configured", async () => {
    enableCustody();
    vi.stubEnv("MAINNET_EXECUTION_ENABLED", "0");
    signInOn(BASE_MAINNET);
    await run(form());
    expect(h.redirects.at(-1)).toBe("/wallet?onchain=disabled");
    expect(sdk.sendTransaction).not.toHaveBeenCalled();
  });

  it("refuses an invalid destination address", async () => {
    enableCustody();
    signInOn(BASE_MAINNET);
    await run(form({ to: "not-an-address" }));
    expect(h.redirects.at(-1)).toBe("/wallet?onchain=address");
    expect(sdk.sendTransaction).not.toHaveBeenCalled();
  });

  it("writes nothing without the explicit confirmation", async () => {
    enableCustody();
    signInOn(BASE_MAINNET);
    await run(form({ confirm: "" }));
    expect(sdk.sendTransaction).not.toHaveBeenCalled();
    expect(await prisma.transaction.count({ where: { userId, kind: "WITHDRAWAL" } })).toBe(0);
  });

  it("refuses when custody is not configured", async () => {
    signInOn(BASE_MAINNET);
    await run(form());
    expect(h.redirects.at(-1)).toBe("/wallet?onchain=disabled");
    expect(sdk.sendTransaction).not.toHaveBeenCalled();
  });

  it("sends a configured mainnet withdrawal and records ledger + audit", async () => {
    enableCustody();
    signInOn(BASE_MAINNET);

    await run(form());

    expect(h.redirects).toEqual([]);
    expect(sdk.sendTransaction).toHaveBeenCalledTimes(1);
    expect(sdk.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "base",
        transaction: expect.objectContaining({ to: DEST }),
      })
    );

    const tx = await prisma.transaction.findFirst({
      where: { userId, kind: "WITHDRAWAL" },
      orderBy: { createdAt: "desc" },
    });
    expect(tx?.detail).toContain("0xwithdraw123");
    // 0.1 ETH at $2000 = $200.00 notional.
    expect(tx?.amountCents).toBe(20_000);
    expect(await prisma.custodySpend.count({ where: { userId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { actorId: userId, action: "custody.spend" } })).toBe(1);
  });
});
