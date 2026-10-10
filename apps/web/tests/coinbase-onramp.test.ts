import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ generateJwt: vi.fn(async () => "jwt-token") }));
vi.mock("@coinbase/cdp-sdk/auth", () => ({ generateJwt: auth.generateJwt }));

import {
  ONRAMP_SESSION_URL,
  ONRAMP_WIDGET_BASE,
  OnrampUnavailableError,
  buildOnrampUrl,
  coinbaseOnrampConfigured,
  createOnrampUrl,
  fetchOnrampSessionToken,
} from "@/lib/coinbase/onramp";

/**
 * Onramp is a real-money hand-off, so the properties are structural: an unconfigured
 * deployment must produce nothing, the URL must follow the documented format, and the
 * session-token request must sign a CDP JWT and POST to the documented endpoint. The
 * SDK's JWT helper and `fetch` are mocked — CI has no live Coinbase account.
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

describe("coinbaseOnrampConfigured", () => {
  it("is false without credentials, so no URL can be produced", () => {
    vi.stubEnv("CDP_API_KEY_ID", "");
    vi.stubEnv("CDP_API_KEY_SECRET", "");
    expect(coinbaseOnrampConfigured()).toBe(false);
  });

  it("needs only the API-key pair — the wallet secret is not required", () => {
    configured();
    vi.stubEnv("CDP_WALLET_SECRET", "");
    expect(coinbaseOnrampConfigured()).toBe(true);
  });
});

describe("buildOnrampUrl", () => {
  it("builds the documented Coinbase-hosted URL", () => {
    const url = buildOnrampUrl({
      sessionToken: "tok_123",
      partnerUserRef: "0xabc",
      defaultNetwork: "base",
      defaultAsset: "USDC",
      presetFiatAmount: 25,
      redirectUrl: "https://app.example/wallet",
    });

    expect(url.startsWith(`${ONRAMP_WIDGET_BASE}?`)).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("sessionToken")).toBe("tok_123");
    expect(q.get("partnerUserRef")).toBe("0xabc");
    expect(q.get("defaultNetwork")).toBe("base");
    expect(q.get("defaultAsset")).toBe("USDC");
    expect(q.get("presetFiatAmount")).toBe("25");
    expect(q.get("redirectUrl")).toBe("https://app.example/wallet");
  });

  it("omits optional parameters and rejects an empty token", () => {
    expect(buildOnrampUrl({ sessionToken: "tok" })).toBe(`${ONRAMP_WIDGET_BASE}?sessionToken=tok`);
    expect(() => buildOnrampUrl({ sessionToken: "   " })).toThrow(OnrampUnavailableError);
  });

  it("caps partnerUserRef at Coinbase's 50-character limit", () => {
    const url = new URL(buildOnrampUrl({ sessionToken: "t", partnerUserRef: "x".repeat(80) }));
    expect(url.searchParams.get("partnerUserRef")).toHaveLength(50);
  });
});

describe("fetchOnrampSessionToken", () => {
  it("fails closed when unconfigured", async () => {
    vi.stubEnv("CDP_API_KEY_ID", "");
    vi.stubEnv("CDP_API_KEY_SECRET", "");
    await expect(
      fetchOnrampSessionToken({ address: "0x1", clientIp: "1.2.3.4" })
    ).rejects.toThrow(OnrampUnavailableError);
  });

  it("requires an address and a client IP", async () => {
    configured();
    await expect(fetchOnrampSessionToken({ address: "", clientIp: "1.2.3.4" })).rejects.toThrow(
      OnrampUnavailableError
    );
    await expect(fetchOnrampSessionToken({ address: "0x1", clientIp: "" })).rejects.toThrow(
      OnrampUnavailableError
    );
  });

  it("signs a JWT and posts to the documented endpoint", async () => {
    configured();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "tok_abc" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await fetchOnrampSessionToken({ address: "0xabc", clientIp: "9.9.9.9" });

    expect(token).toBe("tok_abc");
    expect(auth.generateJwt).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: "key-id",
        apiKeySecret: "key-secret",
        requestMethod: "POST",
        requestHost: "api.developer.coinbase.com",
        requestPath: "/onramp/v1/token",
      })
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ONRAMP_SESSION_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-token");
    const body = JSON.parse(init.body as string) as {
      addresses: { address: string; blockchains: string[] }[];
      clientIp: string;
    };
    expect(body.addresses[0].address).toBe("0xabc");
    expect(body.addresses[0].blockchains).toContain("base");
    expect(body.clientIp).toBe("9.9.9.9");
  });

  it("throws on a non-OK response and on a missing token", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(fetchOnrampSessionToken({ address: "0x1", clientIp: "1.1.1.1" })).rejects.toThrow(
      /HTTP 500/
    );

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    await expect(fetchOnrampSessionToken({ address: "0x1", clientIp: "1.1.1.1" })).rejects.toThrow(
      /session token/
    );
  });

  it("surfaces Coinbase's own error message so the cause is diagnosable", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: "ERROR_CODE_NOT_FOUND",
              message: "failed to find app with cloud project id abc123",
            }),
            { status: 404 }
          )
      )
    );

    await expect(
      fetchOnrampSessionToken({ address: "0x1", clientIp: "1.1.1.1" })
    ).rejects.toThrow(/HTTP 404\): failed to find app with cloud project id abc123/);
  });
});

describe("createOnrampUrl", () => {
  it("requests a session token then assembles the URL", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ token: "tok_x" }), { status: 200 }))
    );

    const url = await createOnrampUrl({ address: "0xdef", clientIp: "8.8.8.8", presetFiatAmount: 50 });
    const q = new URL(url).searchParams;
    expect(q.get("sessionToken")).toBe("tok_x");
    expect(q.get("partnerUserRef")).toBe("0xdef");
    expect(q.get("defaultNetwork")).toBe("base");
    expect(q.get("defaultAsset")).toBe("USDC");
    expect(q.get("presetFiatAmount")).toBe("50");
  });
});
