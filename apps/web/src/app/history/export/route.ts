import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ledgerCsv, transactionsCsv } from "@/lib/export";

/**
 * CSV export of the signed-in user's own history (`?type=transactions|ledger`).
 *
 * Read-only and scoped to the caller: it returns the session user's rows only, never
 * another account's, and is unauthenticated-safe (a missing session returns `401`, not
 * data). No money path is involved.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const type = new URL(request.url).searchParams.get("type") === "ledger" ? "ledger" : "transactions";

  const csv =
    type === "ledger"
      ? ledgerCsv(
          await prisma.ledgerEntry.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
          })
        )
      : transactionsCsv(
          await prisma.transaction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
          })
        );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="veylora-${type}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
