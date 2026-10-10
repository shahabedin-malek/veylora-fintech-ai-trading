import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ generateJwt: vi.fn(async () => "jwt-token") }));
vi.mock("@coinbase/cdp-sdk/auth", () => ({ generateJwt: auth.generateJwt }));

import {
  OFFRAMP_WIDGET_BASE,
  OfframpUnavailableError,
  buildOfframpUrl,
  createOfframpUrl,
} from "@/lib/coinbase/offramp";

/**
 * Offramp is a real-money hand-off, so the properties are structural: the hosted sell
 * URL must follow the documented format, `redirectUrl` must be enforced (Coinbase
 * requires it for Offramp), and an unconfigured deployment must produce nothing.
 */

function configured() {
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  auth.generateJwt.mockClear();
});

describe("buildOfframpUrl", () => {
  it("builds the documented One-Click-Sell URL", () => {
    const url = buildOfframpUrl({
      sessionToken: "tok_1",
      partnerUserRef: "0xabc",
      redirectUrl: "https://app.example/wallet?coinbase=offramp",
      defaultNetwork: "base",
      defaultAsset: "USDC",
      presetCryptoAmount: 0.05,
    });

    expect(url.startsWith(`${OFFRAMP_WIDGET_BASE}?`)).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("sessionToken")).toBe("tok_1");
    expect(q.get("partnerUserRef")).toBe("0xabc");
    expect(q.get("redirectUrl")).toBe("https://app.example/wallet?coinbase=offramp");
    expect(q.get("presetCryptoAmount")).toBe("0.05");
  });

  it("requires a session token and a redirectUrl", () => {
    expect(() =>
      buildOfframpUrl({ sessionToken: "", partnerUserRef: "0xabc", redirectUrl: "https://x" })
    ).toThrow(OfframpUnavailableError);
    expect(() =>
      buildOfframpUrl({ sessionToken: "tok", partnerUserRef: "0xabc", redirectUrl: "" })
    ).toThrow(OfframpUnavailableError);
  });

  it("prefers a crypto amount over a fiat amount", () => {
    const url = new URL(
      buildOfframpUrl({
        sessionToken: "tok",
        partnerUserRef: "0x1",
        redirectUrl: "https://x",
        presetCryptoAmount: 2,
        presetFiatAmount: 500,
      })
    );
    expect(url.searchParams.get("presetCryptoAmount")).toBe("2");
    expect(url.searchParams.get("presetFiatAmount")).toBeNull();
  });
});

describe("createOfframpUrl", () => {
  it("fails closed when unconfigured", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "");
    vi.stubEnv("CDP_API_KEY_SECRET", "");
    await expect(
      createOfframpUrl({ address: "0x1", clientIp: "1.2.3.4", redirectUrl: "https://x" })
    ).rejects.toThrow(OfframpUnavailableError);
  });

  it("requests a session token then assembles the sell URL", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ token: "tok_live" }), { status: 200 }))
    );

    const url = await createOfframpUrl({
      address: "0xdef",
      clientIp: "8.8.8.8",
      redirectUrl: "https://app.example/wallet",
      presetCryptoAmount: 1.5,
    });
    const q = new URL(url).searchParams;
    expect(q.get("sessionToken")).toBe("tok_live");
    expect(q.get("partnerUserRef")).toBe("0xdef");
    expect(q.get("defaultNetwork")).toBe("base");
    expect(q.get("presetCryptoAmount")).toBe("1.5");
  });

  it("surfaces a session-token failure as an offramp error", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(
      createOfframpUrl({ address: "0x1", clientIp: "1.1.1.1", redirectUrl: "https://x" })
    ).rejects.toThrow(OfframpUnavailableError);
  });
});
