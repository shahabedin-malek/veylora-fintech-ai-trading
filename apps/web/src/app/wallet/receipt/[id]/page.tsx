import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";
import { disputeOutcomeLabel, railLabel, statusLabel } from "@/lib/withdrawals";

/**
 * Printable withdrawal receipt (`docs/OPEN_TASKS_AND_IDEAS.md` §7).
 *
 * A read-only, printable record of one withdrawal request — useful for support and for
 * the user's own tax records. It is scoped to the request owner (or an admin) and shows
 * only that request; the destination/tx hash are the user's own data, and no key or
 * secret appears. The page prints cleanly with the browser's own print function.
 */

export default async function WithdrawalReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const request = await prisma.withdrawalRequest.findUnique({ where: { id } });
  if (!request || (request.userId !== user.id && user.role !== "ADMIN")) notFound();

  const rows: [string, string][] = [
    ["Reference", request.id],
    ["Requested", request.createdAt.toLocaleString()],
    ["Route", railLabel(request.rail)],
    ["Amount", formatUsd(request.amountCents)],
    ["Status", statusLabel(request.status)],
  ];
  if (request.decidedAt) rows.push(["Decided", request.decidedAt.toLocaleString()]);
  if (request.reason) rows.push(["Reason", request.reason]);
  if (request.destination) rows.push(["Destination", request.destination]);
  if (request.txHash) rows.push(["Transaction", request.txHash]);
  if (request.disputeClosesAt && !request.disputeOutcome) {
    rows.push(["Dispute open until", request.disputeClosesAt.toISOString().slice(0, 10)]);
  }
  if (request.disputeOutcome) rows.push(["Dispute outcome", disputeOutcomeLabel(request.disputeOutcome)]);

  return (
    <div className="grid" style={{ gap: 20, maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>Withdrawal receipt</h1>

      <section className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Veylora Fintech AI Trading · account{" "}
          <span className="mono">{user.walletAddress}</span> · a record of one withdrawal
          request. No funds are moved by viewing this page.
        </p>
        <table className="data">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" style={{ textAlign: "left" }}>{label}</th>
                <td className="mono" style={{ overflowWrap: "anywhere" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ margin: "12px 0 0", fontSize: 12 }}>
          A declined request returns the amount to your balance; a hold or a ban never moves
          funds. An approved on-chain payout is final.
        </p>
      </section>

      <p>
        <Link className="link" href="/wallet">← Back to wallet</Link>
      </p>
    </div>
  );
}
