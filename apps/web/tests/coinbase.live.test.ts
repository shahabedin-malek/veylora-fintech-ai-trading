import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ONRAMP_WIDGET_BASE,
  buildOnrampUrl,
  coinbaseOnrampConfigured,
  fetchOnrampSessionToken,
} from "@/lib/coinbase/onramp";
import { OFFRAMP_WIDGET_BASE, createOfframpUrl } from "@/lib/coinbase/offramp";
import { verifyCoinbaseSignature } from "@/lib/coinbase/webhook";

/**
 * Live Coinbase smoke test — the onramp/offramp session token and a signed webhook,
 * against the **real** APIs.
 *
 * Skipped unless `COINBASE_LIVE=1`, so CI (no credentials, no Coinbase account) never
 * calls out. Run it locally after setting the `CDP_*` credentials and — for the
 * webhook leg — `COINBASE_WEBHOOK_SECRET`:
 *
 *   COINBASE_LIVE=1 npm run smoke:coinbase
 *
 * To also POST a signed delivery at a running receiver (which must share the same
 * `COINBASE_WEBHOOK_SECRET`), point it at one:
 *
 *   COINBASE_LIVE=1 COINBASE_SMOKE_URL=http://127.0.0.1:3210/api/webhooks/coinbase npm run smoke:coinbase
 *
 * The onramp/offramp legs prove the app can mint a real session token and build the
 * hosted URL; the webhook leg proves an outbound delivery is signed and accepted.
 */

const live = process.env.COINBASE_LIVE === "1";
const hasCdpCredentials = Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET);
const hasWebhookSecret = Boolean(process.env.COINBASE_WEBHOOK_SECRET);

/** A well-known throwaway address (Hardhat account #0) — no funds are moved. */
const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/** Build the `t=,h=,v1=` header the way Coinbase documents it. */
function signDelivery(
  secret: string,
  body: string,
  timestamp: number,
  headerNames: string,
  headers: Record<string, string>
): string {
  const headerValues = headerNames
    .split(" ")
    .map((name) => headers[name] ?? "")
    .join(".");
  const payload = `${timestamp}.${headerNames}.${headerValues}.${body}`;
  const v1 = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestamp},h=${headerNames},v1=${v1}`;
}

describe.skipIf(!live)("live Coinbase smoke", () => {
  it.skipIf(!hasCdpCredentials)("mints a real onramp session token and builds the hosted URL", async () => {
    expect(coinbaseOnrampConfigured(), "set CDP_API_KEY_ID and CDP_API_KEY_SECRET").toBe(true);

    const token = await fetchOnrampSessionToken({ address: TEST_ADDRESS, clientIp: "203.0.113.7" });
    expect(token.length).toBeGreaterThan(0);

    const url = buildOnrampUrl({
      sessionToken: token,
      partnerUserRef: TEST_ADDRESS,
      defaultNetwork: "base",
      defaultAsset: "USDC",
    });
    expect(url.startsWith(ONRAMP_WIDGET_BASE)).toBe(true);
    expect(new URL(url).searchParams.get("sessionToken")).toBe(token);
  });

  it.skipIf(!hasCdpCredentials)("mints an offramp URL with the required redirect", async () => {
    const redirectUrl = "https://example.com/wallet";
    const url = await createOfframpUrl({
      address: TEST_ADDRESS,
      clientIp: "203.0.113.7",
      redirectUrl,
    });

    expect(url.startsWith(OFFRAMP_WIDGET_BASE)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("sessionToken")?.length).toBeGreaterThan(0);
    expect(params.get("redirectUrl")).toBe(redirectUrl);
  });

  it.skipIf(!hasWebhookSecret)("signs a delivery the receiver accepts", async () => {
    const secret = process.env.COINBASE_WEBHOOK_SECRET!;
    const timestamp = Math.floor(Date.now() / 1000);
    const headerNames = "content-type";
    const headers = { "content-type": "application/json" };
    const body = JSON.stringify({
      eventID: `live_${Date.now()}`,
      eventType: "payments.transfers.completed",
      timestamp: new Date().toISOString(),
      data: { transferId: "transfer_live", targetAsset: "usdc", targetAmount: "1.00" },
    });

    const header = signDelivery(secret, body, timestamp, headerNames, headers);

    // Local round-trip: the signature verifies and a tampered body does not.
    expect(verifyCoinbaseSignature({ rawBody: body, signatureHeader: header, secret, headers })).toBe(true);
    expect(
      verifyCoinbaseSignature({ rawBody: `${body} `, signatureHeader: header, secret, headers })
    ).toBe(false);

    const target = process.env.COINBASE_SMOKE_URL;
    if (target) {
      const response = await fetch(target, {
        method: "POST",
        headers: { ...headers, "x-hook0-signature": header },
        body,
      });
      expect(response.status, `POST ${target}`).toBe(200);
    }
  });
});
