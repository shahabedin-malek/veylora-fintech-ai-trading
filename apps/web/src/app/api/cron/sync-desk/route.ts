import { NextResponse } from "next/server";

import { cronDenied } from "@/lib/cron-auth";
import { warmCredentialCache } from "@/lib/credentials/pool";
import { refreshRiskNews } from "@/lib/risk/news";
import { syncSignals } from "@/lib/signals/sync";

/**
 * Scheduled desk-input sync.
 *
 * Refreshes the two things the risk gate reads from storage — provider signals and the
 * news snapshot — so the gate stays current without an operator clicking Sync. It
 * touches no money and can only *record* provider output.
 *
 * Fail-closed, like every other inbound surface:
 *   1. No `CRON_SECRET` ⇒ the endpoint is disabled (`503`). An unauthenticated caller
 *      must never be able to trigger a sync.
 *   2. The `Authorization: Bearer <CRON_SECRET>` header must match in constant time
 *      (this is the header Vercel adds to a cron invocation when `CRON_SECRET` is set)
 *      ⇒ otherwise `401`.
 *
 * The same route works for any scheduler, not just Vercel cron — point a GitHub Action
 * or an uptime pinger at it with the same header.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = cronDenied(request.headers.get("authorization"));
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  try {
    // Warm the key-pool presence cache so pool-only keys are visible to the sync and to
    // the synchronous execution/venue gates.
    await warmCredentialCache();
    const signals = await syncSignals();
    const news = await refreshRiskNews();
    return NextResponse.json({ ok: true, signals, news }, { status: 200 });
  } catch (error) {
    // Report the failure rather than a false success, so a broken schedule is visible.
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "sync failed" },
      { status: 500 }
    );
  }
}
