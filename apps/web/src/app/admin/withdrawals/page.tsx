import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  decideWithdrawalRequestAction,
  releaseWithdrawalFundsAction,
  resolveDisputeAction,
  setAccountBanAction,
  setAccountHoldAction,
} from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";
import {
  disputeOutcomeLabel,
  disputeState,
  disputedRequests,
  pendingRequests,
  railLabel,
  unresolvedFailures,
} from "@/lib/withdrawals";

/**
 * Withdrawal review queue (`/admin/withdrawals`).
 *
 * Where a user's withdrawal request is decided. Two things this page deliberately does
 * **not** offer, because they are not decisions about a request:
 *
 *   - It cannot send a declined user's funds anywhere. Declining releases the reservation
 *     back to its owner, and there is no control here that changes that.
 *   - It cannot move a held account's balance. An account hold freezes movement only; the
 *     balance stays the user's until the hold is lifted on this same page.
 *
 * The only path that moves money is approving an app-settled request, which pays the
 * destination the user themselves named, and a release, which returns held funds to the
 * user after a failed payout.
 */

const NOTICE: Record<string, string> = {
  approved: "Approved. An app-settled payout was signed and sent; a Coinbase hand-off was cleared.",
  declined: "Declined. The amount was returned to the user's balance — no funds moved.",
  refused: "The payout was refused before anything was signed, so the amount was returned to the user.",
  held: "The payout did not complete and may have reached the chain. The amount stays held until you release it.",
  duplicate: "That decision was already recorded. Nothing was applied twice.",
  stale: "That request is no longer awaiting review (someone else decided it, perhaps).",
  invalid: "That decision was not recognised.",
  reason: "A reason is required to decline a request.",
  released: "Held funds returned to the user's balance.",
  nothing: "That request has no held funds to release.",
};

const DISPUTE_NOTICE: Record<string, string> = {
  resolved: "Dispute resolved. No funds moved: a ban freezes the balance, it does not take it.",
  reason: "A reason is required to confirm misuse.",
  invalid: "That dispute outcome was not recognised.",
  duplicate: "That dispute was already resolved (or was submitted twice).",
  stale: "That request has no open dispute to resolve.",
  error: "The dispute could not be resolved.",
};

const BAN_NOTICE: Record<string, string> = {
  banned: "Account banned: sign-in is refused and the balance is frozen (not transferred).",
  unbanned: "Ban lifted. Sign-in and movement are available again; the balance was never touched.",
  reason: "A reason is required to ban an account.",
  protected: "That account is an admin or the site owner — demote it first if a ban is really intended.",
  invalid: "Pick an account to ban.",
  duplicate: "That ban change was already recorded.",
  error: "The ban could not be applied.",
};

const HOLD_NOTICE: Record<string, string> = {
  placed: "Account on hold. Withdrawals and trading are frozen; the balance is untouched.",
  released: "Hold lifted. The account can withdraw and trade again.",
  reason: "A reason is required to place a hold.",
  duplicate: "That hold change was already recorded.",
  invalid: "Pick an account to hold.",
  error: "The hold could not be applied.",
};

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string; release?: string; hold?: string; dispute?: string; ban?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const notice = sp.decision ? NOTICE[sp.decision] : sp.release ? NOTICE[sp.release] : undefined;
  const holdNotice = sp.hold ? HOLD_NOTICE[sp.hold] : undefined;
  const disputeNotice = sp.dispute ? DISPUTE_NOTICE[sp.dispute] : undefined;
  const banNotice = sp.ban ? BAN_NOTICE[sp.ban] : undefined;

  const [pending, failures, disputes, accounts] = await Promise.all([
    pendingRequests(),
    unresolvedFailures(),
    disputedRequests(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        name: true,
        walletAddress: true,
        banned: true,
        wallet: { select: { balanceCents: true, blocked: true, blockedReason: true } },
      },
    }),
  ]);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Withdrawals</h1>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Requests are held from the user&apos;s balance until you decide. Declining returns the
            amount; approving pays the destination the user named.
          </p>
        </div>
        <Link className="link" href="/admin">← Admin home</Link>
      </div>

      {notice && <p role="status" className="badge warn" style={{ width: "fit-content" }}>{notice}</p>}
      {holdNotice && <p role="status" className="badge warn" style={{ width: "fit-content" }}>{holdNotice}</p>}
      {disputeNotice && <p role="status" className="badge warn" style={{ width: "fit-content" }}>{disputeNotice}</p>}
      {banNotice && <p role="status" className="badge warn" style={{ width: "fit-content" }}>{banNotice}</p>}

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Awaiting review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>No requests are waiting.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Account</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Destination</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.createdAt.toLocaleString()}</td>
                  <td>
                    <div>{r.user.name}</div>
                    <div className="muted mono" style={{ fontSize: 11, overflowWrap: "anywhere" }}>{r.user.walletAddress}</div>
                  </td>
                  <td>{railLabel(r.rail)}</td>
                  <td className="mono">{formatUsd(r.amountCents)}</td>
                  <td className="mono" style={{ fontSize: 11, overflowWrap: "anywhere" }}>{r.destination ?? "—"}</td>
                  <td>
                    <div className="grid" style={{ gap: 8 }}>
                      <form action={decideWithdrawalRequestAction} style={{ display: "flex", gap: 6 }}>
                        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button className="btn primary" type="submit">Approve</button>
                      </form>
                      <form action={decideWithdrawalRequestAction} className="grid" style={{ gap: 6 }}>
                        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="decision" value="decline" />
                        <label className="field" htmlFor={`reason-${r.id}`}>Reason to decline</label>
                        <input className="input" id={`reason-${r.id}`} name="reason" type="text" placeholder="e.g. destination not verified" required />
                        <button className="btn" type="submit">Decline and return funds</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Payouts needing resolution ({failures.length})</h2>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
          These payouts did not complete and may have reached the chain, so the amount stays held.
          Check the destination on-chain, then release the funds if nothing arrived.
        </p>
        {failures.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing is stuck.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Decided</th>
                <th>Account</th>
                <th>Amount</th>
                <th>What happened</th>
                <th>Release</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((r) => (
                <tr key={r.id}>
                  <td>{r.decidedAt?.toLocaleString() ?? "—"}</td>
                  <td>{r.user.name}</td>
                  <td className="mono">{formatUsd(r.amountCents)}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.reason ?? "Payout failed"}</td>
                  <td>
                    <form action={releaseWithdrawalFundsAction} className="grid" style={{ gap: 6 }}>
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <input type="hidden" name="requestId" value={r.id} />
                      <label className="field" htmlFor={`release-${r.id}`}>Reason</label>
                      <input className="input" id={`release-${r.id}`} name="reason" type="text" placeholder="e.g. checked chain, nothing broadcast" required />
                      <button className="btn" type="submit">Return funds to the user</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>
          Disputes ({disputes.filter((r) => !r.disputeOutcome).length} open)
        </h2>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
          A declined request gives the user a window to argue the case in the support thread
          assigned to you. Resolving it moves no money: clearing leaves the refusal standing,
          and confirming misuse bans the account and <b>freezes</b> the balance (it is never
          transferred). The window expiring is not a decision — resolve it either way.
        </p>
        {disputes.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>No declined requests.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Decided</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Dispute window</th>
                <th>Resolve</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((r) => {
                const state = disputeState(r);
                return (
                  <tr key={r.id}>
                    <td>{r.decidedAt?.toLocaleString() ?? "—"}</td>
                    <td>
                      {r.user.name}
                      {r.user.banned && <span className="badge warn" style={{ marginLeft: 6 }}>banned</span>}
                    </td>
                    <td className="mono">{formatUsd(r.amountCents)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {state.closesAt ? `until ${state.closesAt.toISOString().slice(0, 10)}` : "—"}
                      {state.outcome
                        ? ` · ${disputeOutcomeLabel(state.outcome)}`
                        : state.expired
                          ? " · window closed, unresolved"
                          : ` · ${state.daysLeft} business day(s) left`}
                    </td>
                    <td>
                      {state.outcome ? (
                        <span className="muted" style={{ fontSize: 12 }}>Resolved</span>
                      ) : (
                        <div className="grid" style={{ gap: 8 }}>
                          <form action={resolveDisputeAction} style={{ display: "flex", gap: 6 }}>
                            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                            <input type="hidden" name="requestId" value={r.id} />
                            <input type="hidden" name="outcome" value="CLEARED" />
                            <button className="btn" type="submit">Clear — no action</button>
                          </form>
                          <form action={resolveDisputeAction} className="grid" style={{ gap: 6 }}>
                            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                            <input type="hidden" name="requestId" value={r.id} />
                            <input type="hidden" name="outcome" value="MISUSE_CONFIRMED" />
                            <label className="field" htmlFor={`misuse-${r.id}`}>
                              Reason to confirm misuse (bans the account, freezes the balance)
                            </label>
                            <input
                              className="input"
                              id={`misuse-${r.id}`}
                              name="reason"
                              type="text"
                              placeholder="e.g. exploit used to inflate the balance"
                              required
                            />
                            <button className="btn" type="submit">Confirm misuse</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Account holds</h2>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
          A hold freezes withdrawals and trading while an account is reviewed. It never moves or
          forfeits the balance — the funds stay the user&apos;s, and lifting the hold restores access.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th>Balance</th>
              <th>State</th>
              <th>Hold</th>
              <th>Ban (access)</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acct) => (
              <tr key={acct.id}>
                <td>
                  <div>{acct.name}</div>
                  <div className="muted mono" style={{ fontSize: 11, overflowWrap: "anywhere" }}>{acct.walletAddress}</div>
                </td>
                <td className="mono">{formatUsd(acct.wallet?.balanceCents ?? 0)}</td>
                <td>
                  {acct.banned && <div><span className="badge warn">banned</span></div>}
                  {acct.wallet?.blocked ? (
                    <>
                      <span className="badge warn">on hold</span>
                      <div className="muted" style={{ fontSize: 11 }}>{acct.wallet.blockedReason}</div>
                    </>
                  ) : (
                    <span className="badge live">movement open</span>
                  )}
                </td>
                <td>
                  <form action={setAccountHoldAction} className="grid" style={{ gap: 6 }}>
                    <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                    <input type="hidden" name="userId" value={acct.id} />
                    <input type="hidden" name="hold" value={acct.wallet?.blocked ? "" : "on"} />
                    {!acct.wallet?.blocked && (
                      <>
                        <label className="field" htmlFor={`hold-${acct.id}`}>Reason for the hold</label>
                        <input className="input" id={`hold-${acct.id}`} name="reason" type="text" placeholder="e.g. suspected abuse — under review" required />
                      </>
                    )}
                    <button className="btn" type="submit">
                      {acct.wallet?.blocked ? "Lift hold" : "Place hold"}
                    </button>
                  </form>
                </td>
                <td>
                  <form action={setAccountBanAction} className="grid" style={{ gap: 6 }}>
                    <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                    <input type="hidden" name="userId" value={acct.id} />
                    <input type="hidden" name="ban" value={acct.banned ? "" : "on"} />
                    {!acct.banned && (
                      <>
                        <label className="field" htmlFor={`ban-${acct.id}`}>Reason to ban</label>
                        <input
                          className="input"
                          id={`ban-${acct.id}`}
                          name="reason"
                          type="text"
                          placeholder="e.g. confirmed misuse"
                          required
                        />
                      </>
                    )}
                    <button className="btn" type="submit">{acct.banned ? "Lift ban" : "Ban account"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
