import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { formatUsd } from "@/lib/domain/money";
import {
  requestWithdrawalAction,
  startCoinbaseDepositAction,
  startCoinbaseWithdrawalAction,
  startOnChainWithdrawalAction,
} from "@/lib/actions";
import {
  disputeOutcomeLabel,
  holdState,
  myRequests,
  railLabel,
  statusDetail,
  statusLabel,
} from "@/lib/withdrawals";
import { ONRAMP_BLOCKCHAINS, coinbaseOnrampConfigured } from "@/lib/coinbase/onramp";
import { custodyAvailable } from "@/lib/custody";
import { custodyDepositAddress, transferNetworkForChainId } from "@/lib/custody/transfers";
import { complianceStatus } from "@/lib/compliance";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import BorderGlow from "@/components/reactbits/BorderGlow";

/** Reasons the Coinbase deposit hand-off can bounce back to this page. */
const COINBASE_NOTICE: Record<string, string> = {
  unconfigured: "Coinbase deposits are not configured on this deployment.",
  error: "Coinbase could not start a deposit right now. Please try again in a moment.",
  offramp:
    "Coinbase is processing your sale. Your balance here updates only after a verified webhook reconciles it.",
};

/** Reasons a withdrawal *request* can bounce back to this page. */
const REQUEST_NOTICE: Record<string, string> = {
  submitted: "Request submitted. The amount is held from your balance until an admin reviews it.",
  rail: "Choose a withdrawal route.",
  invalid: "Enter a positive amount.",
  confirm: "Tick the confirmation — a request moves real funds once approved.",
  network: "On-chain withdrawals are not offered on this network. Connect on Ethereum, Base or Arbitrum.",
  address: "That destination address is not valid.",
  checksum:
    "That destination address mixes cases in a way EIP-55 rejects, so at least one character is wrong. Check it against the source.",
  zero: "The zero address is not a destination — everything sent to it is destroyed.",
  price:
    "No live ETH price is available right now, so the amount cannot be valued. Nothing was requested.",
  cap: "That is above the per-request limit on this deployment.",
  funds: "That amount is more than your available balance.",
  blocked: "This account is on hold, so no withdrawal can be requested. Contact support — your balance is unaffected.",
  duplicate: "That request was already submitted.",
  error: "The request could not be created. Nothing was reserved.",
};

/** Reasons the on-chain custody withdrawal can bounce back to this page. */
const ONCHAIN_NOTICE: Record<string, string> = {
  disabled:
    "On-chain withdrawal is unavailable — real execution is switched off (MAINNET_EXECUTION_ENABLED=0) or custody is not configured.",
  network: "On-chain withdrawal is not offered on this network. Connect a wallet on Ethereum, Base or Arbitrum.",
  address: "That destination address is not valid. Nothing was sent.",
  checksum:
    "That destination address mixes cases in a way EIP-55 rejects, which means at least one character is wrong. Check it against the source. Nothing was sent.",
  zero: "The zero address is not a destination — everything sent to it is destroyed. Nothing was sent.",
  price:
    "No live ETH price is available right now, so the spend cap cannot be computed. Nothing was sent.",
  blocked: "Compliance screening refused this withdrawal. Nothing was sent.",
  hold: "This account is on hold, so no funds can move out. Contact support — your balance is unaffected.",
  error: "The on-chain withdrawal could not be submitted. Nothing was sent.",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ coinbase?: string; onchain?: string; request?: string }>;
}) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/login");
  const sp = await searchParams;

  const { wallet } = ctx;
  const coinbaseConfigured = coinbaseOnrampConfigured();
  const coinbaseNotice = sp.coinbase ? COINBASE_NOTICE[sp.coinbase] : undefined;
  const onchainNotice = sp.onchain ? ONCHAIN_NOTICE[sp.onchain] : undefined;
  const custodyReady = custodyAvailable();
  const transferNetwork = transferNetworkForChainId(ctx.user.chainId);
  const depositAddress = custodyReady ? await custodyDepositAddress().catch(() => null) : null;
  const screening = complianceStatus();
  const requests = await myRequests(ctx.user.id);
  const requestNotice = sp.request ? REQUEST_NOTICE[sp.request] : undefined;
  const hold = holdState({ blocked: wallet.blocked, blockedReason: wallet.blockedReason });
  // Admins may withdraw directly; everyone else goes through the review queue below, so
  // no user can move funds out of the platform without a decision being recorded.
  const isAdmin = ctx.user.role === "ADMIN";

  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1 style={{ margin: 0 }}>Wallet</h1>

      <div className="grid cols-2">
        <BorderGlow
          className="card"
          backgroundColor="var(--bg-card)"
          borderRadius={14}
          glowColor="160 64 52"
          colors={["#38d39f", "#4c8dff", "#5227FF"]}
          glowIntensity={0.9}
          fillOpacity={0.35}
        >
          <h2 style={{ marginTop: 0 }}>Balance</h2>
          <div className="mono" style={{ fontSize: 34 }}>{formatUsd(wallet.balanceCents)}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6, overflowWrap: "anywhere" }}>
            real account balance · <span className="mono">{wallet.address}</span>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Credited by reconciled deposits (card/bank via Coinbase or an on-chain transfer) and
            debited by real withdrawals and trades. Every movement is real and final.
          </p>
        </BorderGlow>

        <SpotlightCard className="card" spotlightColor="#4c8dff" intensity={0.16} proximity={90}>
          <h2 style={{ marginTop: 0 }}>Deposit with Coinbase</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Buy crypto with a card or bank through Coinbase. It is delivered to <b>your own wallet</b> —
            the app never custodies it — and is credited here only after a verified Coinbase webhook
            reconciles the transfer.
          </p>
          <div className="grid cols-2" style={{ gap: 12, alignItems: "start" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Your wallet address</div>
              <div className="mono" style={{ overflowWrap: "anywhere", fontSize: 13 }}>{wallet.address}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Supported networks: {ONRAMP_BLOCKCHAINS.join(", ")}
              </div>
            </div>
            {coinbaseConfigured ? (
              <form action={startCoinbaseDepositAction} className="grid" style={{ gap: 10 }}>
                <div>
                  <label className="field" htmlFor="coinbase-amount">Amount (USD, optional)</label>
                  <input className="input" id="coinbase-amount" name="amount" type="number" min="1" step="1" placeholder="100" />
                </div>
                <button className="btn primary" type="submit">Buy with Coinbase</button>
              </form>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Coinbase deposits are not configured on this deployment. Set the CDP API credentials
                (<span className="mono">CDP_API_KEY_ID</span> / <span className="mono">CDP_API_KEY_SECRET</span>).
              </p>
            )}
          </div>
          {coinbaseNotice && (
            <p role="status" className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>{coinbaseNotice}</p>
          )}
        </SpotlightCard>
      </div>

      <SpotlightCard className="card" spotlightColor="#5227FF" intensity={0.16} proximity={90}>
        <h2 style={{ marginTop: 0 }}>Withdraw with Coinbase</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Cash out crypto to your bank through Coinbase&apos;s One-Click-Sell flow. The funds move from
          <b> your own wallet</b> — the app never signs the transfer — and your balance here is
          updated only after a verified Coinbase webhook reconciles the sale.
        </p>
        {!isAdmin ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Withdrawals are reviewed before they leave. Submit a <b>Request a withdrawal</b> below and an
            admin decides it — declining returns the amount to your balance untouched.
          </p>
        ) : coinbaseConfigured ? (
          <form action={startCoinbaseWithdrawalAction} className="grid" style={{ gap: 10 }}>
            <div>
              <label className="field" htmlFor="coinbase-crypto-amount">Amount (crypto, optional)</label>
              <input className="input" id="coinbase-crypto-amount" name="amount" type="number" min="0" step="any" placeholder="e.g. 0.05" />
            </div>
            <button className="btn primary" type="submit">Sell with Coinbase</button>
          </form>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Coinbase withdrawals are not configured on this deployment. Set the CDP API credentials.
          </p>
        )}
        {coinbaseNotice && (
          <p role="status" className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>{coinbaseNotice}</p>
        )}
      </SpotlightCard>

      <SpotlightCard className="card" spotlightColor="#38d39f" intensity={0.16} proximity={90}>
        <h2 style={{ marginTop: 0 }}>Deposit &amp; withdraw on-chain (custody)</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Send or receive crypto directly. Crypto sent to the deposit address is credited here only
          after a verified webhook reconciles the transfer; a withdrawal is signed by the platform
          custody account (the app holds no key) and is final.
        </p>
        {!custodyReady ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            On-chain transfers are not configured on this deployment. They need a custody backend
            (e.g. <span className="mono">CUSTODY_PROVIDER=coinbase-cdp</span>) and its CDP credentials.
          </p>
        ) : (
          <div className="grid cols-2" style={{ gap: 12, alignItems: "start" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Deposit address (platform custody)</div>
              <div className="mono" style={{ overflowWrap: "anywhere", fontSize: 13 }}>{depositAddress ?? wallet.address}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Send only on the network you signed in with. Credited after webhook reconciliation.
              </div>
            </div>
            {!isAdmin ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Admins can withdraw immediately from here; your withdrawals are reviewed. Use
                <b> Request a withdrawal</b> below so an admin can approve or decline it.
              </p>
            ) : transferNetwork ? (
              <form action={startOnChainWithdrawalAction} className="grid" style={{ gap: 10 }}>
                {/* A stable key for this rendered form: a double submit (or a retry of
                    the same rendered form) re-uses it, so the movement is claimed once. */}
                <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                <div>
                  <label className="field" htmlFor="onchain-to">Destination address</label>
                  <input
                    className="input mono"
                    id="onchain-to"
                    name="to"
                    type="text"
                    placeholder="0x…"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </div>
                <div>
                  <label className="field" htmlFor="onchain-amount">Amount (native, e.g. ETH)</label>
                  <input className="input" id="onchain-amount" name="amount" type="number" min="0" step="any" placeholder="e.g. 0.05" required />
                </div>
                <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
                  <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
                  <span>I understand this moves real funds on-chain and cannot be undone.</span>
                </label>
                <button className="btn primary" type="submit">Withdraw on-chain</button>
              </form>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                On-chain withdrawal is not offered on this network. Connect on Ethereum, Base or Arbitrum.
              </p>
            )}
          </div>
        )}
        <p className="muted" style={{ margin: "12px 0 0", fontSize: 12 }}>{screening.note}</p>
        {onchainNotice && (
          <p role="status" className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>{onchainNotice}</p>
        )}
      </SpotlightCard>

      <SpotlightCard className="card" spotlightColor="#4c8dff" intensity={0.16} proximity={90}>
        <h2 style={{ marginTop: 0 }}>Request a withdrawal</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Withdrawals are reviewed before they leave. Submitting a request <b>holds</b> the amount
          from your balance — it is not sent yet — and an admin approves or declines it. A declined
          request returns the amount to your balance untouched; an approved on-chain payout is final.
        </p>

        {hold.blocked ? (
          <p role="status" className="muted" style={{ margin: 0, fontSize: 13 }}>
            This account is on hold{hold.reason ? `: ${hold.reason}` : ""}. Withdrawals and trading are
            paused while it is reviewed. Your balance is unaffected - contact support.
          </p>
        ) : (
          <form action={requestWithdrawalAction} className="grid" style={{ gap: 10, maxWidth: 460 }}>
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <div>
              <label className="field" htmlFor="request-rail">Route</label>
              <select className="input" id="request-rail" name="rail" defaultValue="CUSTODY_ONCHAIN">
                <option value="CUSTODY_ONCHAIN">On-chain, from the custody wallet (amount in ETH)</option>
                <option value="COINBASE_OFFRAMP">Coinbase, sell to bank (amount in USD)</option>
              </select>
            </div>
            <div>
              <label className="field" htmlFor="request-amount">Amount</label>
              <input
                className="input"
                id="request-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="ETH for on-chain · USD for Coinbase"
                required
              />
            </div>
            <div>
              <label className="field" htmlFor="request-to">Destination address (on-chain route)</label>
              <input
                className="input mono"
                id="request-to"
                name="to"
                type="text"
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
              <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
              <span>
                I understand the amount is held while an admin reviews this request, and that an approved
                on-chain withdrawal moves real funds and cannot be undone.
              </span>
            </label>
            <button className="btn primary" type="submit">Request withdrawal</button>
          </form>
        )}

        {requestNotice && (
          <p role="status" className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>{requestNotice}</p>
        )}

        {requests.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Route</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Detail</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.createdAt.toLocaleString()}</td>
                    <td>{railLabel(r.rail)}</td>
                    <td className="mono">{formatUsd(r.amountCents)}</td>
                    <td>{statusLabel(r.status)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {r.reason ? `${r.reason} ` : ""}
                      {statusDetail(r.status)}
                      {r.disputeClosesAt && !r.disputeOutcome && (
                        <>
                          {" "}
                          You can discuss this in <Link className="link" href="/support">support</Link> until{" "}
                          {r.disputeClosesAt.toISOString().slice(0, 10)}.
                        </>
                      )}
                      {r.disputeOutcome ? ` ${disputeOutcomeLabel(r.disputeOutcome)}.` : ""}
                    </td>
                    <td>
                      <Link className="link" href={`/wallet/receipt/${r.id}`}>Receipt</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}
