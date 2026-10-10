import { NextResponse } from "next/server";
import {
  COINBASE_SIGNATURE_HEADER,
  coinbaseWebhookConfigured,
  parseCoinbaseEvent,
  verifyCoinbaseSignature,
} from "@/lib/coinbase/webhook";
import { ingestCoinbaseEvent } from "@/lib/coinbase/ingest";

/**
 * Coinbase CDP webhook receiver (`PHASE19-006`).
 *
 * Fail-closed in order:
 *   1. No `COINBASE_WEBHOOK_SECRET` ⇒ the endpoint is disabled (`503`) and accepts
 *      nothing. An unverifiable delivery must never reach the ledger.
 *   2. Signature must verify against the **raw** body ⇒ otherwise `401`.
 *   3. Body must parse as a JSON object ⇒ otherwise `400`.
 *   4. The (de-duplicated) event is ingested; a replay returns `200` as a no-op so
 *      Coinbase does not keep retrying a delivery we have already applied.
 *
 * Signature verification needs the raw bytes, so the body is read as text and never
 * re-serialized before verification.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = (process.env.COINBASE_WEBHOOK_SECRET ?? "").trim();
  if (!coinbaseWebhookConfigured()) {
    return NextResponse.json(
      { error: "webhook disabled: COINBASE_WEBHOOK_SECRET is not set" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();

  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const verified = verifyCoinbaseSignature({
    rawBody,
    signatureHeader: request.headers.get(COINBASE_SIGNATURE_HEADER),
    secret,
    headers,
  });
  if (!verified) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = parseCoinbaseEvent(rawBody);
  if (!event) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const result = await ingestCoinbaseEvent(event);
  // Acknowledged even when unmatched/ignored — those are terminal outcomes, and a
  // non-2xx would make Coinbase retry a delivery we cannot act on.
  return NextResponse.json({ result }, { status: 200 });
}
