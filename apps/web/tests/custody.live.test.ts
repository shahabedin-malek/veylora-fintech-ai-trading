import { recoverMessageAddress } from "viem";
import { describe, expect, it } from "vitest";

import { custodyAvailable, getCustodySigner } from "@/lib/custody";

/**
 * Live custody signing against the real provider (PHASE18-004).
 *
 * Skipped unless `CUSTODY_LIVE=1`, so CI — which has no credentials and no
 * Coinbase account — never calls out. Run it locally after setting
 * `CUSTODY_PROVIDER=coinbase-cdp`, `CUSTODY_KEY_ID` and the `CDP_*` credentials:
 *
 *   CUSTODY_LIVE=1 npm test -- tests/custody.live.test.ts
 *
 * It proves the end-to-end property that matters: the app can obtain a signature
 * from a key it does not hold, and that signature recovers to the signer address.
 */

const live = process.env.CUSTODY_LIVE === "1";

describe.skipIf(!live)("live Coinbase CDP custody signing", () => {
  it("is configured and available", () => {
    expect(
      custodyAvailable(),
      "set CUSTODY_PROVIDER=coinbase-cdp, CUSTODY_KEY_ID and CDP_API_KEY_ID/CDP_API_KEY_SECRET/CDP_WALLET_SECRET"
    ).toBe(true);
  });

  it("signs a message with a provider-held key that recovers to its address", async () => {
    const signer = await getCustodySigner();
    expect(signer.address).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const message = "Veylora custody live check";
    const signature = await signer.signMessage({ message });
    expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);

    const recovered = await recoverMessageAddress({ message, signature });
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase());
  });
});
