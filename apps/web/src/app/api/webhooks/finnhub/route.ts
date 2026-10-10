import { NextResponse } from "next/server";
import { ingestFinnhubEvent } from "@/lib/finnhub/ingest";
import {
  FINNHUB_SECRET_HEADER,
  finnhubWebhookConfigured,
  parseFinnhubEvent,
  verifyFinnhubSecret,
} from "@/lib/finnhub/webhook";

/**
 * Finnhub webhook receiver.
 *
 * Fail-closed in order:
 *   1. No `FINNHUB_WEBHOOK_SECRET` ⇒ the endpoint is disabled (`503`) and accepts
 *      nothing. An unverifiable delivery is never trusted.
 *   2. `X-Finnhub-Secret` must match in constant time ⇒ otherwise `401`.
 *   3. The body must parse as a JSON object ⇒ otherwise `400`.
 *   4. The delivery is recorded once (de-duplicated by a body-derived id) and
 *      acknowledged promptly with `200`.
 *
 * The receiver is **value-free**: it applies no balance change, because no Finnhub
 * event type is a value-in instruction. See `src/lib/finnhub/ingest.ts`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!finnhubWebhookConfigured()) {
    return NextResponse.json(
      { error: "webhook disabled: FINNHUB_WEBHOOK_SECRET is not set" },
      { status: 503 }
    );
  }

  const secret = (process.env.FINNHUB_WEBHOOK_SECRET ?? "").trim();
  const rawBody = await request.text();

  const verified = verifyFinnhubSecret({
    provided: request.headers.get(FINNHUB_SECRET_HEADER),
    secret,
  });
  if (!verified) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const event = parseFinnhubEvent(rawBody);
  if (!event) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // Finnhub disables a subscription that fails to acknowledge, so record and return
  // promptly; a replay is a 200 no-op.
  const result = await ingestFinnhubEvent({ event, rawBody });
  return NextResponse.json({ result }, { status: 200 });
}
