import { NextResponse } from "next/server";

import { cronDenied } from "@/lib/cron-auth";
import { reconcileDesk } from "@/lib/reconcile";

/**
 * Scheduled desk reconciliation.
 *
 * Runs the internal consistency check (`src/lib/reconcile.ts`): custody bookkeeping
 * (every movement recorded both its amount and its audit row) and payouts held for
 * review. It **moves no money** and only records its findings — it cannot approve,
 * release or send anything.
 *
 * Fail-closed like every scheduled route: disabled until `CRON_SECRET` is set (`503`),
 * then bearer-authorised (`401` otherwise). Point Vercel cron, a GitHub Action or an
 * uptime pinger at it with the same header.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = cronDenied(request.headers.get("authorization"));
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  try {
    const report = await reconcileDesk();
    return NextResponse.json({ ok: report.ok, report }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "reconcile failed" },
      { status: 500 }
    );
  }
}
