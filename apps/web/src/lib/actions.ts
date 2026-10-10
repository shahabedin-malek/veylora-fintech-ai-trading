"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isWalletBanned, requireAdmin, requireUser, signInWithWallet } from "@/lib/auth";
import { isOwnerWallet } from "@/lib/owner";
import { issueNonce, verifySiwe } from "@/lib/siwe";
import { networkClassForChainId } from "@/lib/network";
import { warmCredentialCache } from "@/lib/credentials/pool";
import { executionGate } from "@/lib/execution";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { formatUsd, usdToCents } from "@/lib/domain/money";
import { DEPOSIT_CAP_CENTS } from "@/lib/config";
import { DuplicateOperationError, idempotencyKeyFrom, runOnce } from "@/lib/idempotency";
import { coinbaseOnrampConfigured, createOnrampUrl } from "@/lib/coinbase/onramp";
import { createOfframpUrl } from "@/lib/coinbase/offramp";
import {
  CustodyUnavailableError,
  SpendLimitExceededError,
  custodyKeyReference,
} from "@/lib/custody";
import {
  custodySpentTodayCents,
  recordCustodyAudit,
  recordCustodySpend,
} from "@/lib/custody/spend-ledger";
import {
  TransferUnavailableError,
  sendCustodyTransfer,
  transferNetworkForChainId,
  verifyEvmAddress,
} from "@/lib/custody/transfers";
import { ComplianceRefusedError, screenTransferOrThrow } from "@/lib/compliance";
import { assessDeskRisk } from "@/lib/risk/assess";
import {
  type SwapPreset,
  coinbaseSwapConfigured,
  executeCoinbaseSwap,
  parseAmountToAtomic,
  swapPreset,
} from "@/lib/coinbase/trading";
import { getQuotesSafe } from "@/lib/market";
import { WundertradingRefusedError, executeWundertradingOrder } from "@/lib/wundertrading/orders";
import {
  WithdrawalRefusedError,
  disputeWindow,
  holdState,
  isDisputeOutcome,
  isWithdrawalRail,
  openDisputeTicket,
  railIsAppSettled,
  refundReservation,
  reserveWithdrawal,
} from "@/lib/withdrawals";

export type FormState = { error?: string; ok?: string } | undefined;

// ---------------------------------------------------------------- helpers

/**
 * Whether the account is on hold (an admin froze movement while reviewing it).
 *
 * A hold stops funds from *leaving* — withdrawal requests, the admin fast-path withdrawal
 * and swaps all check it — while deposits and reconciliation keep working. It never
 * touches the balance: the money stays the user's, which is the whole difference between
 * a hold and taking it.
 */
async function accountOnHold(userId: string): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { blocked: true } });
  return Boolean(wallet?.blocked);
}

/**
 * Explicit spend confirmation. Every value-in/value-out action requires it, and it
 * is checked **server-side**: the form's `required` checkbox is a convenience, not
 * the guard. A caller that skips it mutates nothing.
 */
function isConfirmed(formData: FormData | undefined): boolean {
  return formData?.get("confirm") === "on";
}

// ---------------------------------------------------------------- auth

/**
 * The host this sign-in request was served from. `SIWE_DOMAIN` pins it explicitly
 * (useful behind a proxy or in tests); otherwise it is taken from the request.
 */
async function expectedDomain(): Promise<string> {
  const configured = process.env.SIWE_DOMAIN?.trim();
  if (configured) return configured;
  const requestHeaders = await headers();
  return requestHeaders.get("host") ?? "localhost:3000";
}

/** Hands the client a single-use nonce to embed in the SIWE message. */
export async function requestNonceAction(): Promise<{ nonce: string } | { error: string }> {
  try {
    return { nonce: await issueNonce() };
  } catch {
    return { error: "Could not start the sign-in. Please try again." };
  }
}

/**
 * Verifies a signed SIWE message, provisions the wallet account and opens a
 * session. The address is trusted only after `verifySiwe` succeeds.
 */
export async function verifySiweAction(input: {
  message: string;
  signature: string;
}): Promise<FormState> {
  const message = typeof input?.message === "string" ? input.message : "";
  const signature = typeof input?.signature === "string" ? input.signature : "";
  if (!message || !signature) return { error: "That sign-in did not complete. Please try again." };

  const result = await verifySiwe(message, signature, { domain: await expectedDomain() });
  if (!result.ok) return { error: result.reason };

  // The chain id is claimed by the signing client, so it is validated here before
  // any session exists: only a chain this app offers may sign in, and its class is
  // what will gate execution. An unsupported chain is refused outright rather than
  // defaulted to a class.
  const networkClass = networkClassForChainId(result.chainId);
  // A practice network is owner-only and is never advertised: an ordinary wallet that
  // tries one gets the same generic answer as an unknown chain, so the owner
  // capability stays invisible. Ownership is checked against the **verified** address.
  if (!networkClass || (networkClass !== "MAINNET" && !isOwnerWallet(result.address))) {
    return {
      error: "That network is not supported. Switch to Ethereum, Base or Arbitrum.",
    };
  }

  // A banned account cannot sign in. The message is deliberately the same shape as any
  // other refusal (no hint about why, and no confirmation that the address is known to us
  // beyond what the signature already proves).
  if (await isWalletBanned(result.address)) {
    return { error: "This wallet cannot sign in. Contact support if you believe this is a mistake." };
  }

  const user = await signInWithWallet(result.address, result.chainId);
  await setSessionCookie(user.id, result.chainId);
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

// ---------------------------------------------------------------- owner

/**
 * Credit the owner's own account with **practice funds** — value with no real backing.
 *
 * Owner-only by construction: `user.isOwner` is derived server-side from the verified
 * session (`src/lib/owner.ts`), the credited wallet is the signed-in owner's own, and a
 * replay is a no-op through `runOnce`. Nothing here reaches the custody boundary or a
 * real venue; it is a labelled ledger credit an owner can use to exercise the desk.
 */
export async function ownerCreditPracticeFundsAction(formData?: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.isOwner) throw new Error("FORBIDDEN");

  const rawAmount = String(formData?.get("amount") ?? "").trim();
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) redirect("/admin?owner=invalid");
  const cents = usdToCents(amount);
  if (cents <= 0) redirect("/admin?owner=invalid");
  if (cents > DEPOSIT_CAP_CENTS) redirect("/admin?owner=cap");

  // Explicit server-side confirmation, matching every other ledger movement.
  if (!isConfirmed(formData)) return;

  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(user.id, "owner_practice_funds", key, async (tx) => {
      await tx.wallet.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          address: user.walletAddress,
          kind: "MAINNET",
          network: "mainnet",
          balanceCents: cents,
        },
        update: { balanceCents: { increment: cents } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          type: "DEPOSIT",
          amountCents: cents,
          note: "Owner practice funds",
        },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          kind: "DEPOSIT",
          amountCents: cents,
          status: "COMPLETED",
          detail: "Owner practice funds (no real value)",
        },
      });
      await tx.notification.create({
        data: {
          userId: user.id,
          title: "Practice funds credited",
          body: `Credited ${formatUsd(cents)} of practice funds to your account for testing.`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "owner.practice_funds",
          subject: user.walletAddress,
          detail: `+${cents} cents`,
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/admin?owner=duplicate");
    redirect("/admin?owner=error");
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/wallet");
  revalidatePath("/history");
  redirect("/admin?owner=credited");
}

// ---------------------------------------------------------------- deposits

/** Best-effort client IP for Coinbase's session-token security check. */
async function requestClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "127.0.0.1";
}

/**
 * Start a Coinbase Onramp deposit (`PHASE19-003`).
 *
 * Onramp hands the user to Coinbase-hosted checkout and delivers crypto to their
 * **own** wallet, so it does not run through the app's execution gate (which guards
 * funds the app moves). It is still fail-closed: an unconfigured deployment or an
 * API failure redirects back to `/wallet` with a reason instead of producing a URL.
 */
export async function startCoinbaseDepositAction(formData?: FormData): Promise<void> {
  const user = await requireUser();
  if (!coinbaseOnrampConfigured()) redirect("/wallet?coinbase=unconfigured");

  const amount = Number(formData?.get("amount"));
  let url: string;
  try {
    url = await createOnrampUrl({
      address: user.walletAddress,
      clientIp: await requestClientIp(),
      presetFiatAmount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    });
  } catch {
    redirect("/wallet?coinbase=error");
  }
  redirect(url);
}

/** The public origin of the current request, for the required offramp redirect. */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Start a Coinbase Offramp withdrawal (`PHASE19-005`).
 *
 * Offramp hands the user to Coinbase's One-Click-Sell flow, where they send crypto
 * from their own wallet and Coinbase pays out to their bank — the app never signs a
 * movement, so this does not run through the execution gate. It is fail-closed the
 * same way as the deposit hand-off: unconfigured or an API failure redirects back to
 * `/wallet` with a reason instead of producing a URL.
 */
export async function startCoinbaseWithdrawalAction(formData?: FormData): Promise<void> {
  const user = await requireUser();
  if (!coinbaseOnrampConfigured()) redirect("/wallet?coinbase=unconfigured");

  const amount = Number(formData?.get("amount"));
  let url: string;
  try {
    url = await createOfframpUrl({
      address: user.walletAddress,
      clientIp: await requestClientIp(),
      redirectUrl: `${await requestOrigin()}/wallet?coinbase=offramp`,
      presetCryptoAmount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    });
  } catch {
    redirect("/wallet?coinbase=error");
  }
  redirect(url);
}

// ---------------------------------------------------- on-chain custody transfer

/**
 * Withdraw real crypto directly from the custody wallet (`PHASE18-005`).
 *
 * This is the one path that moves real funds **out** on-chain, so it is guarded on
 * every axis: the execution gate must allow it
 * (custody configured, kill switch clear); the chain must be one transfers are offered
 * on; the destination must be a valid address; the notional is computed from a **live**
 * price (a real movement is never capped against a fallback one); the custody spend
 * limits are enforced against the **persisted** ledger before anything is sent; and the
 * compliance boundary is consulted first. Fail-closed: any problem redirects back to
 * `/wallet` with a reason instead of sending.
 */
export async function startOnChainWithdrawalAction(formData?: FormData): Promise<void> {
  const user = await requireUser();
  if (await accountOnHold(user.id)) redirect("/wallet?onchain=hold");

  const gate = executionGate(user.network);
  if (!gate.allowed) redirect("/wallet?onchain=disabled");
  const network = transferNetworkForChainId(user.chainId);
  if (!network) redirect("/wallet?onchain=network");

  const rawTo = String(formData?.get("to") ?? "").trim();
  // Destination verification, not just shape: a final transfer means a plausible but
  // wrong address is the expensive mistake. See `verifyEvmAddress`.
  const destination = verifyEvmAddress(rawTo);
  if (!destination.ok) {
    const reason = destination.problem === "format" ? "address" : destination.problem;
    redirect(`/wallet?onchain=${reason}`);
  }

  const rawAmount = String(formData?.get("amount") ?? "").trim();
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return;
  const valueWei = parseAmountToAtomic(rawAmount, 18); // native asset, 18 decimals
  if (valueWei === null) return;

  // Real, irreversible value movement: require the explicit server-side confirmation.
  if (!isConfirmed(formData)) return;

  // Notional against a live price; refuse rather than cap against a fallback one.
  const { quotes } = await getQuotesSafe(["ETH"]);
  const quote = quotes.find((q) => q.symbol === "ETH" && !q.offline);
  if (!quote || !Number.isFinite(quote.priceUsd) || quote.priceUsd <= 0) {
    redirect("/wallet?onchain=price");
  }
  const notionalCents = usdToCents(amount * quote.priceUsd);

  try {
    await screenTransferOrThrow({
      userId: user.id,
      address: user.walletAddress,
      amountCents: notionalCents,
      direction: "WITHDRAWAL",
      network,
      // The destination receives the value, so it is screened too — a sanctioned
      // recipient is the hit that matters on a withdrawal.
      counterparty: rawTo,
    });
  } catch (error) {
    if (error instanceof ComplianceRefusedError) redirect("/wallet?onchain=blocked");
    redirect("/wallet?onchain=error");
  }

  const reference = custodyKeyReference();
  const keyReference = reference ? `${reference.provider}:${reference.keyId}` : undefined;
  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(user.id, "custody_withdraw", key, async (tx) => {
      const spentTodayCents = await custodySpentTodayCents(user.id, tx);
      const transfer = await sendCustodyTransfer({
        chainId: user.chainId,
        to: destination.address,
        valueWei,
        notionalCents,
        spentTodayCents,
        idempotencyKey: key,
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          kind: "WITHDRAWAL",
          amountCents: notionalCents,
          status: "COMPLETED",
          detail: `On-chain withdrawal to ${rawTo} · ${transfer.transactionHash}`,
        },
      });
      await recordCustodySpend(
        {
          userId: user.id,
          address: transfer.from,
          amountCents: notionalCents,
          ref: transfer.transactionHash,
        },
        tx
      );
      await recordCustodyAudit(
        {
          userId: user.id,
          address: transfer.from,
          amountCents: notionalCents,
          ref: transfer.transactionHash,
          keyReference,
          action: "On-chain withdrawal",
        },
        tx
      );
      await tx.notification.create({
        data: {
          userId: user.id,
          title: "Withdrawal submitted",
          body: `On-chain withdrawal of ${amount} ETH submitted (${transfer.transactionHash.slice(0, 10)}…).`,
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) return; // replay: already submitted
    redirect("/wallet?onchain=error");
  }
  revalidatePath("/wallet");
  revalidatePath("/history");
}

// ------------------------------------------------------- coinbase trading

/**
 * USD notional (cents) of a swap's from-side, from a **real** price. Returns null
 * when no live price is available — a real swap must not be capped against a
 * fallback price, so the caller refuses rather than guessing.
 */
async function swapNotionalCents(preset: SwapPreset, amount: number): Promise<number | null> {
  if (preset.fixedUsd) return usdToCents(amount * preset.fixedUsd);
  if (!preset.priceSymbol) return null;
  const { quotes } = await getQuotesSafe([preset.priceSymbol]);
  const quote = quotes.find((q) => q.symbol === preset.priceSymbol && !q.offline);
  if (!quote || !Number.isFinite(quote.priceUsd) || quote.priceUsd <= 0) return null;
  return usdToCents(amount * quote.priceUsd);
}

/**
 * Execute a real Coinbase swap (`PHASE19-004`).
 *
 * This is the one path that moves real funds, so it is guarded on every axis:
 * the execution gate must allow it (custody available and the kill switch clear), the
 * swap must be configured and on the chain the wallet signed in on, and the custody
 * spend limits are enforced inside the adapter before anything is signed. It is
 * fail-closed: any problem redirects back to `/trade` with a reason instead of
 * executing.
 */
export async function startCoinbaseSwapAction(formData?: FormData): Promise<void> {
  const user = await requireUser();
  // Reflect any pool-managed custody key in the synchronous execution gate.
  await warmCredentialCache(["coinbase-cdp"]);
  if (await accountOnHold(user.id)) redirect("/trade?coinbase=hold");

  // Reuse the single gate rather than re-deriving the decision, but translate a
  // refusal into a friendly redirect (a real trade never silently falls back).
  const gate = executionGate(user.network);
  if (!gate.allowed) redirect("/trade?coinbase=disabled");
  if (!coinbaseSwapConfigured()) redirect("/trade?coinbase=unconfigured");

  const pair = formData?.get("pair");
  const preset = swapPreset(typeof pair === "string" ? pair : null);
  if (!preset) redirect("/trade?coinbase=invalid");
  if (preset.chainId !== user.chainId) redirect("/trade?coinbase=network");

  // Real, irreversible value movement: require the explicit server-side confirmation.
  if (!isConfirmed(formData)) return;

  const rawAmount = String(formData?.get("amount") ?? "");
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return;
  const fromAmount = parseAmountToAtomic(rawAmount, preset.fromDecimals);
  if (fromAmount === null) return;

  const notionalCents = await swapNotionalCents(preset, amount);
  if (notionalCents === null) redirect("/trade?coinbase=price");

  // Desk risk gate: recent news and stored signals can refuse new risk. It can only
  // refuse — it never opens or sizes a position, and it runs before anything is signed.
  const risk = await assessDeskRisk();
  if (risk.riskOff) redirect("/trade?coinbase=risk");

  // Compliance gate. The default (no-op) provider allows; a configured one can refuse
  // or fail closed, and either way nothing is signed.
  try {
    await screenTransferOrThrow({
      userId: user.id,
      address: user.walletAddress,
      amountCents: notionalCents,
      direction: "TRADE",
      network: preset.network,
    });
  } catch (error) {
    if (error instanceof ComplianceRefusedError) redirect("/trade?coinbase=blocked");
    redirect("/trade?coinbase=error");
  }

  const reference = custodyKeyReference();
  const keyReference = reference ? `${reference.provider}:${reference.keyId}` : undefined;

  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(user.id, "coinbase_swap", key, async (tx) => {
      // Rolling spend for the daily cap, read from the persisted ledger so it reflects
      // what actually moved rather than a caller-supplied total.
      const spentTodayCents = await custodySpentTodayCents(user.id, tx);
      const execution = await executeCoinbaseSwap({
        network: preset.network,
        fromToken: preset.fromToken,
        toToken: preset.toToken,
        fromAmount,
        notionalCents,
        spentTodayCents,
        idempotencyKey: key,
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          kind: "TRADE",
          amountCents: notionalCents,
          status: "COMPLETED",
          detail: `Coinbase swap ${preset.label} · ${execution.transactionHash}`,
        },
      });
      // Persist the movement in the rolling ledger + audit trail, in the same
      // transaction as the record of the swap.
      await recordCustodySpend(
        {
          userId: user.id,
          address: reference?.keyId ?? preset.network,
          amountCents: notionalCents,
          ref: execution.transactionHash,
        },
        tx
      );
      await recordCustodyAudit(
        {
          userId: user.id,
          address: reference?.keyId ?? preset.network,
          amountCents: notionalCents,
          ref: execution.transactionHash,
          keyReference,
          action: `Coinbase swap ${preset.label}`,
        },
        tx
      );
      await tx.notification.create({
        data: {
          userId: user.id,
          title: "Swap submitted",
          body: `${preset.label} submitted on-chain (${execution.transactionHash.slice(0, 10)}…).`,
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) return; // replay: already submitted
    redirect("/trade?coinbase=error");
  }
  revalidatePath("/trade");
  revalidatePath("/dashboard");
}

// ------------------------------------------------------- venue orders (WunderTrading)

/**
 * Place a real venue order through WunderTrading.
 *
 * Operator-only: the venue API acts on the desk's exchange API profiles, not on a
 * single user's balance, so this is a desk capability rather than a user flow. It is
 * gated exactly like the swap path — the execution gate for the `wundertrading`
 * executor, then the desk risk gate — and it never sends an order without a stop loss or
 * over the desk's real-money cap. Idempotent (a retry cannot place a second order) and
 * recorded in both the transaction history and the audit trail.
 *
 * The USD notional is **declared by the operator** and is what the cap is enforced on:
 * the venue's amount semantics are not price-based, so the desk states the exposure it
 * is taking and is held to it.
 */
export async function startWundertradingOrderAction(formData?: FormData): Promise<void> {
  const admin = await requireAdmin();
  // Reflect any pool-managed venue key in the synchronous execution gate.
  await warmCredentialCache(["wundertrading"]);

  const gate = executionGate(admin.network, "wundertrading");
  if (!gate.allowed) redirect("/admin/execution?venue=disabled");

  const risk = await assessDeskRisk();
  if (risk.riskOff) redirect("/admin/execution?venue=risk");

  if (!isConfirmed(formData)) return;

  const value = (name: string) => String(formData?.get(name) ?? "").trim();
  const notionalUsd = Number(value("notionalUsd"));
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) redirect("/admin/execution?venue=invalid");
  const notionalCents = usdToCents(notionalUsd);

  const input = {
    exchangeCode: value("exchangeCode"),
    pairCode: value("pairCode"),
    profilesCodes: value("profilesCodes").split(",").map((s) => s.trim()).filter(Boolean),
    side: value("side") === "sell" ? ("sell" as const) : ("buy" as const),
    orderType: value("orderType"),
    amountPerTrade: value("amountPerTrade"),
    amountPerTradeType: value("amountPerTradeType"),
    stopLoss: value("stopLoss"),
    takeProfit: value("takeProfit") || undefined,
    notionalCents,
  };

  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(admin.id, "venue_order", key, async (tx) => {
      // Rolling daily total for the venue cap, from what was actually placed today.
      const spent = await tx.transaction.aggregate({
        where: {
          userId: admin.id,
          kind: "VENUE_ORDER",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _sum: { amountCents: true },
      });

      const execution = await executeWundertradingOrder({
        ...input,
        spentTodayCents: spent._sum.amountCents ?? 0,
      });

      await tx.transaction.create({
        data: {
          userId: admin.id,
          kind: "VENUE_ORDER",
          amountCents: notionalCents,
          status: "COMPLETED",
          detail: `WunderTrading ${input.side} ${input.pairCode} on ${input.exchangeCode} · stop ${input.stopLoss}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "Venue order",
          subject: `${input.side} ${input.pairCode}`,
          detail: `notional ${notionalCents}c, stop loss ${input.stopLoss}, exchange ${input.exchangeCode}`,
        },
      });
      await tx.notification.create({
        data: {
          userId: admin.id,
          title: "Venue order submitted",
          body: `${input.side.toUpperCase()} ${input.pairCode} on ${input.exchangeCode} submitted with a stop at ${input.stopLoss}.`,
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) return; // replay: already submitted
    if (error instanceof WundertradingRefusedError) redirect("/admin/execution?venue=refused");
    redirect("/admin/execution?venue=error");
  }

  revalidatePath("/admin/execution");
  revalidatePath("/admin");
}

// ---------------------------------------------------------------- CRM

export async function createTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!subject || !body) return;

  const customer = (await prisma.customer.findUnique({ where: { userId: user.id } })) ??
    (await prisma.customer.create({ data: { userId: user.id, name: user.name } }));

  const count = await prisma.ticket.count();
  const ticket = await prisma.ticket.create({
    data: {
      number: `TCK-${1001 + count}`,
      customerId: customer.id,
      ownerId: user.id,
      subject,
      status: "OPEN",
      priority: "NORMAL",
      messages: { create: { authorId: user.id, body } },
    },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "ticket.created", subject: ticket.number, detail: subject } });
  revalidatePath("/support");
  revalidatePath("/admin");
  redirect(`/support?ticket=${ticket.id}`);
}

export async function sendTicketMessageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!ticketId || !body) return;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.ownerId !== user.id) return;
  await prisma.ticketMessage.create({ data: { ticketId, authorId: user.id, body, internal: false } });
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: "OPEN", updatedAt: new Date() } });
  revalidatePath("/support");
}

export async function adminUpdateTicketAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const ticketId = String(formData.get("ticketId") || "");
  const status = String(formData.get("status") || "");
  const priority = String(formData.get("priority") || "");
  const assigneeId = String(formData.get("assigneeId") || "");
  const body = String(formData.get("body") || "").trim();
  const internal = formData.get("internal") === "on";

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;
  if (assigneeId) data.assigneeId = assigneeId === "none" ? null : assigneeId;

  if (body) {
    await prisma.ticketMessage.create({ data: { ticketId, authorId: admin.id, body, internal } });
    if (!internal) data.status = status || "PENDING";
  }
  await prisma.ticket.update({ where: { id: ticketId }, data: { ...data, updatedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "ticket.updated", subject: ticketId, detail: JSON.stringify(data) } });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
}

// ------------------------------------------- withdrawal approval workflow

/**
 * A user requests a withdrawal; an admin decides it later (`src/lib/withdrawals.ts`).
 *
 * The amount is **reserved** here, not at decision time: it leaves the spendable balance
 * immediately (so it cannot be spent twice while the request waits) and comes back
 * untouched if the request is declined. The requested amount is priced once, from a live
 * quote, so the admin approves exactly what the user asked for — never a re-priced figure.
 *
 * Fail-closed and explicit: an account on hold cannot request, the destination is verified
 * (not merely shaped), a fallback price is refused rather than used for a real movement,
 * and a replay is a no-op through `runOnce`.
 */
export async function requestWithdrawalAction(formData?: FormData): Promise<void> {
  const user = await requireUser();

  const rail = String(formData?.get("rail") ?? "").trim();
  if (!isWithdrawalRail(rail)) redirect("/wallet?request=rail");

  // A hold blocks movement out. Checked here for a clear message, and enforced again
  // inside the reservation, so a hold placed mid-request cannot be bypassed.
  const heldWallet = await prisma.wallet.findUnique({
    where: { userId: user.id },
    select: { blocked: true, blockedReason: true },
  });
  if (holdState(heldWallet).blocked) redirect("/wallet?request=blocked");

  if (!isConfirmed(formData)) redirect("/wallet?request=confirm");

  const rawAmount = String(formData?.get("amount") ?? "").trim();
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) redirect("/wallet?request=invalid");

  let amountCents: number;
  let destination: string | null = null;
  let nativeWei: string | null = null;
  let label: string;

  if (rail === "CUSTODY_ONCHAIN") {
    if (!transferNetworkForChainId(user.chainId)) redirect("/wallet?request=network");

    const verified = verifyEvmAddress(String(formData?.get("to") ?? "").trim());
    if (!verified.ok) {
      redirect(`/wallet?request=${verified.problem === "format" ? "address" : verified.problem}`);
    }
    destination = verified.address;

    const wei = parseAmountToAtomic(rawAmount, 18); // native asset, 18 decimals
    if (wei === null) redirect("/wallet?request=invalid");
    // Stored as a decimal string so the exact requested amount survives the round trip.
    nativeWei = wei.toString();

    // Priced now, from a live quote: a fallback price must not value a real movement.
    const { quotes } = await getQuotesSafe(["ETH"]);
    const quote = quotes.find((q) => q.symbol === "ETH" && !q.offline);
    if (!quote || !Number.isFinite(quote.priceUsd) || quote.priceUsd <= 0) redirect("/wallet?request=price");
    amountCents = usdToCents(amount * quote.priceUsd);
    label = `On-chain withdrawal of ${rawAmount} ETH`;
  } else {
    amountCents = usdToCents(amount);
    label = `Coinbase withdrawal of ${formatUsd(amountCents)}`;
  }

  if (amountCents <= 0) redirect("/wallet?request=invalid");
  if (amountCents > DEPOSIT_CAP_CENTS) redirect("/wallet?request=cap");

  const key = idempotencyKeyFrom(formData);
  let requestId: string;
  try {
    const request = await runOnce(user.id, "withdraw_request", key, (tx) =>
      reserveWithdrawal(tx, {
        userId: user.id,
        amountCents,
        rail,
        chainId: user.chainId,
        destination,
        nativeWei,
        label,
      })
    );
    requestId = request.id;
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/wallet?request=duplicate");
    if (error instanceof WithdrawalRefusedError) {
      redirect(`/wallet?request=${error.code === "ACCOUNT_BLOCKED" ? "blocked" : "funds"}`);
    }
    redirect("/wallet?request=error");
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "withdrawal.requested",
      subject: requestId,
      detail: `${label} — ${formatUsd(amountCents)} reserved, awaiting review`,
    },
  });
  revalidatePath("/wallet");
  revalidatePath("/admin/withdrawals");
  redirect("/wallet?request=submitted");
}

/**
 * Approve or decline a pending withdrawal request (admin only).
 *
 * The two outcomes are deliberately asymmetric, because only one of them can move funds:
 *
 *   - **Decline** — nothing was ever sent, so the reservation is returned to the user in
 *     the same transaction, with the reason recorded and shown to them. A decline is not a
 *     forfeiture: refusing a withdrawal leaves the user's money with the user.
 *   - **Approve** — the app settles the rail it can sign (`CUSTODY_ONCHAIN`: compliance
 *     screening, then a custody-signed broadcast) or, for the Coinbase hand-off rail,
 *     records a clearance and releases the reservation, because the app never signs that
 *     flow and the real debit arrives later as a reconciled webhook.
 *
 * A failed payout is split by what is actually known: a refusal from the gate, the spend
 * cap, custody or compliance happened **before** anything could be signed, so the funds go
 * straight back; any other error may have reached the chain, so the funds stay held and
 * only an admin can release them after checking.
 */
export async function decideWithdrawalRequestAction(formData?: FormData): Promise<void> {
  const admin = await requireAdmin();

  const requestId = String(formData?.get("requestId") ?? "").trim();
  const decision = String(formData?.get("decision") ?? "").trim();
  const reason = String(formData?.get("reason") ?? "").trim();

  if (!requestId || (decision !== "approve" && decision !== "decline")) {
    redirect("/admin/withdrawals?decision=invalid");
  }
  if (decision === "decline" && !reason) redirect("/admin/withdrawals?decision=reason");

  const key = idempotencyKeyFrom(formData);
  let request: { id: string; userId: string; amountCents: number; rail: string; chainId: number; destination: string | null; nativeWei: string | null };
  try {
    request = await runOnce(admin.id, "withdraw_decision", key, async (tx) => {
      const found = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        select: { id: true, userId: true, amountCents: true, rail: true, chainId: true, destination: true, nativeWei: true, status: true },
      });
      if (!found || found.status !== "PENDING") {
        throw new WithdrawalRefusedError("NOT_PENDING", "That request is not awaiting review.");
      }
      return found;
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/admin/withdrawals?decision=duplicate");
    redirect("/admin/withdrawals?decision=stale");
  }

  const decidedAt = new Date();

  // --- decline: nothing moved, so the reservation goes back to the user, and the
  // user gets a bounded window to argue it in the support chat. ------------------
  if (decision === "decline") {
    const window = disputeWindow(decidedAt);

    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: "DECLINED",
          reason,
          decidedById: admin.id,
          decidedAt,
          disputeOpensAt: window.opensAt,
          disputeClosesAt: window.closesAt,
          disputeOutcome: null,
        },
      });
      await refundReservation(tx, {
        requestId: request.id,
        userId: request.userId,
        amountCents: request.amountCents,
        note: "Withdrawal request declined — amount returned to your balance",
      });

      // The dispute is argued in the normal support conversation, assigned to the admin
      // who declined it, so the thread and the decision stay together.
      const applicant = await tx.user.findUnique({
        where: { id: request.userId },
        select: { name: true },
      });
      const ticket = await openDisputeTicket(tx, {
        userId: request.userId,
        userName: applicant?.name ?? "Account holder",
        adminId: admin.id,
        subject: `Withdrawal request declined — ${formatUsd(request.amountCents)}`,
        body: `Your withdrawal request for ${formatUsd(request.amountCents)} was declined: ${reason}.\n\nNo funds moved — the amount is back in your available balance. If you believe this is wrong, reply here before ${window.closesAt.toISOString().slice(0, 10)} and an admin will review the case.`,
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: "Withdrawal declined — you can respond",
          body: `Your withdrawal request was declined: ${reason}. The amount is back in your available balance (no funds moved). You can discuss it in support ticket ${ticket.number} until ${window.closesAt.toISOString().slice(0, 10)}.`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "withdrawal.declined",
          subject: request.id,
          detail: `${reason} — dispute open until ${window.closesAt.toISOString()} (ticket ${ticket.number})`,
        },
      });
    });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/wallet");
    redirect("/admin/withdrawals?decision=declined");
  }

  // --- approve, Coinbase hand-off rail: a clearance, not a settlement. --------
  if (!railIsAppSettled(request.rail)) {
    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reason: null, decidedById: admin.id, decidedAt },
      });
      await refundReservation(tx, {
        requestId: request.id,
        userId: request.userId,
        amountCents: request.amountCents,
        note: "Withdrawal approved — cleared to sell through Coinbase",
      });
      await tx.notification.create({
        data: {
          userId: request.userId,
          title: "Withdrawal approved",
          body: "You can complete the sale in the Coinbase flow. Your balance here is debited only when a verified webhook reconciles it.",
        },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "withdrawal.approved.offramp", subject: request.id, detail: `cleared ${formatUsd(request.amountCents)}` },
      });
    });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/wallet");
    redirect("/admin/withdrawals?decision=approved");
  }

  // --- approve, app-settled rail: sign and broadcast. -------------------------
  // Marked approved *before* the network call so a crash mid-send is visible as an
  // approved request without a hash, rather than a silently retryable one.
  await prisma.withdrawalRequest.update({
    where: { id: request.id },
    data: { status: "APPROVED", reason: null, decidedById: admin.id, decidedAt },
  });

  const [user, network] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.userId }, select: { walletAddress: true } }),
    Promise.resolve(transferNetworkForChainId(request.chainId)),
  ]);

  let settled: { txHash: string | null; from: string } | null = null;
  let failure: { reason: string; refundable: boolean } | null = null;

  try {
    if (!network) throw new TransferUnavailableError(`On-chain transfers are not supported on chain ${request.chainId}.`);
    if (!request.destination || !request.nativeWei) {
      throw new TransferUnavailableError("This request has no verified destination to pay.");
    }

    // Screening runs before anything can be signed.
    await screenTransferOrThrow({
      userId: request.userId,
      address: user?.walletAddress ?? "",
      amountCents: request.amountCents,
      direction: "WITHDRAWAL",
      network,
      counterparty: request.destination,
    });

    const transfer = await sendCustodyTransfer({
      chainId: request.chainId,
      to: request.destination,
      valueWei: BigInt(request.nativeWei),
      notionalCents: request.amountCents,
      spentTodayCents: await custodySpentTodayCents(request.userId),
      idempotencyKey: key,
    });
    settled = { txHash: transfer.transactionHash, from: transfer.from };
  } catch (error) {
    const preSigning =
      error instanceof TransferUnavailableError ||
      error instanceof SpendLimitExceededError ||
      error instanceof CustodyUnavailableError ||
      error instanceof ComplianceRefusedError;
    failure = {
      reason: error instanceof Error ? error.message : "The payout could not be completed.",
      refundable: preSigning,
    };
  }

  if (settled) {
    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: { txHash: settled!.txHash },
      });
      await tx.transaction.updateMany({
        where: { userId: request.userId, ref: request.id },
        data: { status: "COMPLETED", detail: `On-chain withdrawal to ${request.destination} · ${settled!.txHash}` },
      });
      await recordCustodySpend(
        {
          userId: request.userId,
          address: settled!.from,
          amountCents: request.amountCents,
          ref: settled!.txHash ?? request.id,
        },
        tx
      );
      await recordCustodyAudit(
        {
          userId: request.userId,
          address: settled!.from,
          amountCents: request.amountCents,
          ref: settled!.txHash ?? request.id,
          keyReference: (() => {
            const reference = custodyKeyReference();
            return reference ? `${reference.provider}:${reference.keyId}` : undefined;
          })(),
          action: "Approved withdrawal request",
        },
        tx
      );
      await tx.notification.create({
        data: {
          userId: request.userId,
          title: "Withdrawal sent",
          body: `${formatUsd(request.amountCents)} was sent on-chain to the destination you named.`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "withdrawal.approved",
          subject: request.id,
          detail: `${formatUsd(request.amountCents)} → ${request.destination} · ${settled!.txHash}`,
        },
      });
    });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/wallet");
    redirect("/admin/withdrawals?decision=approved");
  }

  // The payout did not complete. Refund only when nothing could have been signed.
  await prisma.$transaction(async (tx) => {
    await tx.withdrawalRequest.update({
      where: { id: request.id },
      data: {
        status: failure!.refundable ? "RELEASED" : "FAILED",
        reason: failure!.refundable ? `${failure!.reason} (amount returned)` : `${failure!.reason} — verify before releasing`,
      },
    });
    if (failure!.refundable) {
      await refundReservation(tx, {
        requestId: request.id,
        userId: request.userId,
        amountCents: request.amountCents,
        note: "Withdrawal payout refused before signing — amount returned to your balance",
      });
    }
    await tx.notification.create({
      data: {
        userId: request.userId,
        title: failure!.refundable ? "Withdrawal not sent" : "Withdrawal needs review",
        body: failure!.refundable
          ? `The payout was refused before anything was signed (${failure!.reason}). The amount is back in your available balance.`
          : `The payout could not be completed. Your amount is held while an admin verifies the chain.`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "withdrawal.payoutFailed",
        subject: request.id,
        detail: `${failure!.refundable ? "refunded" : "held"} — ${failure!.reason}`,
      },
    });
  });
  revalidatePath("/admin/withdrawals");
  revalidatePath("/wallet");
  redirect(`/admin/withdrawals?decision=${failure!.refundable ? "refused" : "held"}`);
}

/**
 * Return a held reservation to the user after a failed payout (admin only).
 *
 * Only ever valid for a `FAILED` request — one where the send may have reached the chain.
 * The admin is asserting they checked and nothing landed, and the reason is recorded.
 * This cannot send funds anywhere: `refundReservation` credits the requesting user and
 * nothing else.
 */
export async function releaseWithdrawalFundsAction(formData?: FormData): Promise<void> {
  const admin = await requireAdmin();

  const requestId = String(formData?.get("requestId") ?? "").trim();
  const reason = String(formData?.get("reason") ?? "").trim();
  if (!requestId) redirect("/admin/withdrawals?release=invalid");
  if (!reason) redirect("/admin/withdrawals?release=reason");

  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(admin.id, "withdraw_release", key, async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        select: { id: true, userId: true, amountCents: true, status: true },
      });
      if (!request || request.status !== "FAILED") {
        throw new WithdrawalRefusedError("NOTHING_TO_RELEASE", "That request has no held funds to release.");
      }
      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: { status: "RELEASED", reason: `Funds returned by admin: ${reason}` },
      });
      await refundReservation(tx, {
        requestId: request.id,
        userId: request.userId,
        amountCents: request.amountCents,
        note: "Failed withdrawal released — amount returned to your balance",
      });
      await tx.notification.create({
        data: {
          userId: request.userId,
          title: "Withdrawal funds returned",
          body: "The payout did not go through and an admin returned the amount to your available balance.",
        },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "withdrawal.released", subject: request.id, detail: reason },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/admin/withdrawals?release=duplicate");
    if (error instanceof WithdrawalRefusedError) redirect("/admin/withdrawals?release=nothing");
    redirect("/admin/withdrawals?release=error");
  }

  revalidatePath("/admin/withdrawals");
  revalidatePath("/wallet");
  redirect("/admin/withdrawals?release=released");
}

/**
 * Put an account under review, or lift it (admin only).
 *
 * A hold **freezes movement, it does not move funds**: the balance stays exactly where it
 * is, deposits still reconcile, and releasing the hold restores the account untouched. It
 * blocks new withdrawal requests and swaps. The reason is required and recorded so the
 * hold is explainable to the user later; a hold is not a decision about ownership.
 */
export async function setAccountHoldAction(formData?: FormData): Promise<void> {
  const admin = await requireAdmin();

  const userId = String(formData?.get("userId") ?? "").trim();
  const hold = formData?.get("hold") === "on";
  const reason = String(formData?.get("reason") ?? "").trim();
  if (!userId) redirect("/admin/withdrawals?hold=invalid");
  if (hold && !reason) redirect("/admin/withdrawals?hold=reason");

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, walletAddress: true },
  });
  if (!account) redirect("/admin/withdrawals?hold=invalid");

  const appliedAt = new Date();
  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(admin.id, "account_hold", key, async (tx) => {
      await tx.wallet.upsert({
        where: { userId: account.id },
        create: {
          userId: account.id,
          address: account.walletAddress,
          kind: "MAINNET",
          network: "mainnet",
          balanceCents: 0,
          blocked: hold,
          blockedReason: hold ? reason : null,
          blockedAt: hold ? appliedAt : null,
        },
        update: {
          blocked: hold,
          blockedReason: hold ? reason : null,
          blockedAt: hold ? appliedAt : null,
        },
      });
      await tx.notification.create({
        data: {
          userId: account.id,
          title: hold ? "Account under review" : "Account review complete",
          body: hold
            ? `Withdrawals and trading are paused while we review this account: ${reason}. Your balance is unaffected — contact support.`
            : "The review is complete and withdrawals and trading are available again.",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: hold ? "account.hold" : "account.holdReleased",
          subject: account.id,
          detail: hold ? reason : "released",
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/admin/withdrawals?hold=duplicate");
    redirect("/admin/withdrawals?hold=error");
  }

  revalidatePath("/admin/withdrawals");
  redirect(`/admin/withdrawals?hold=${hold ? "placed" : "released"}`);
}

/**
 * Resolve the dispute a declined withdrawal opened (admin only).
 *
 * Two outcomes, and **neither moves money**:
 *
 *   - `CLEARED` — the refusal stands, nothing else happens, and the case is closed with the
 *     reason recorded. The user already has the amount back.
 *   - `MISUSE_CONFIRMED` — the account is **banned** (sign-in refused, existing sessions
 *     invalidated) and its balance **frozen** (a hold), both with the reason recorded and the
 *     user notified in the thread they were told to argue in.
 *
 * The frozen balance stays the account holder's. Taking a balance to an operator wallet is a
 * transfer of ownership that needs a documented, adjudicated process — not a consequence of
 * an admin form, which is why there is deliberately no destination input here.
 */
export async function resolveDisputeAction(formData?: FormData): Promise<void> {
  const admin = await requireAdmin();

  const requestId = String(formData?.get("requestId") ?? "").trim();
  const outcome = String(formData?.get("outcome") ?? "").trim();
  const reason = String(formData?.get("reason") ?? "").trim();

  if (!requestId || !isDisputeOutcome(outcome)) redirect("/admin/withdrawals?dispute=invalid");
  if (outcome === "MISUSE_CONFIRMED" && !reason) redirect("/admin/withdrawals?dispute=reason");

  const decidedAt = new Date();
  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(admin.id, "dispute_resolution", key, async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({
        where: { id: requestId },
        select: { id: true, userId: true, amountCents: true, status: true, disputeOpensAt: true, disputeOutcome: true },
      });
      if (!request || request.status !== "DECLINED" || !request.disputeOpensAt) {
        throw new WithdrawalRefusedError("NOTHING_TO_RELEASE", "That request has no dispute to resolve.");
      }
      if (request.disputeOutcome) {
        throw new WithdrawalRefusedError("NOTHING_TO_RELEASE", "That dispute is already resolved.");
      }

      await tx.withdrawalRequest.update({
        where: { id: request.id },
        data: { disputeOutcome: outcome },
      });

      if (outcome === "CLEARED") {
        await tx.notification.create({
          data: {
            userId: request.userId,
            title: "Review complete — no action taken",
            body: "Your withdrawal request stays declined and no further action was taken. The amount remained in your balance throughout.",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: "withdrawal.disputeCleared",
            subject: request.id,
            detail: reason || "no action taken",
          },
        });
        return;
      }

      // Misuse confirmed: ban access and freeze the balance. The funds stay the user's —
      // they are only stopped from moving while the case is documented.
      await tx.user.update({
        where: { id: request.userId },
        data: { banned: true, bannedReason: reason, bannedAt: decidedAt },
      });
      await tx.wallet.upsert({
        where: { userId: request.userId },
        create: {
          userId: request.userId,
          address: "",
          kind: "MAINNET",
          network: "mainnet",
          balanceCents: 0,
          blocked: true,
          blockedReason: reason,
          blockedAt: decidedAt,
        },
        update: { blocked: true, blockedReason: reason, blockedAt: decidedAt },
      });
      await tx.notification.create({
        data: {
          userId: request.userId,
          title: "Account banned",
          body: `Following the review of your withdrawal request, this account is banned: access is blocked and the balance is frozen (${reason}). The support thread for this case stays open.`,
        },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "account.banned", subject: request.userId, detail: `misuse confirmed — ${reason}` },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "withdrawal.disputeMisuseConfirmed", subject: request.id, detail: reason },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/admin/withdrawals?dispute=duplicate");
    if (error instanceof WithdrawalRefusedError) redirect("/admin/withdrawals?dispute=stale");
    redirect("/admin/withdrawals?dispute=error");
  }

  revalidatePath("/admin/withdrawals");
  redirect("/admin/withdrawals?dispute=resolved");
}

/**
 * Ban or unban an account directly (admin only).
 *
 * The standalone control for cases that are not a withdrawal dispute. A ban refuses sign-in
 * and invalidates existing sessions (`getCurrentUser`), and — because a banned account must
 * not be able to move funds — it also places the balance hold. Lifting a ban clears both,
 * leaving the balance untouched throughout.
 *
 * Two accounts are protected, because a ban is an access lock and locking the operators out
 * of their own console is not a recoverable mistake: an `ADMIN` account and the configured
 * site owner. Demote the account first if that is genuinely intended.
 */
export async function setAccountBanAction(formData?: FormData): Promise<void> {
  const admin = await requireAdmin();

  const userId = String(formData?.get("userId") ?? "").trim();
  const ban = formData?.get("ban") === "on";
  const reason = String(formData?.get("reason") ?? "").trim();
  if (!userId) redirect("/admin/withdrawals?ban=invalid");
  if (ban && !reason) redirect("/admin/withdrawals?ban=reason");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, walletAddress: true, banned: true },
  });
  if (!target) redirect("/admin/withdrawals?ban=invalid");
  if (ban && (target.role === "ADMIN" || isOwnerWallet(target.walletAddress))) {
    redirect("/admin/withdrawals?ban=protected");
  }

  const appliedAt = new Date();
  const key = idempotencyKeyFrom(formData);
  try {
    await runOnce(admin.id, "account_ban", key, async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { banned: ban, bannedReason: ban ? reason : null, bannedAt: ban ? appliedAt : null },
      });
      // A ban implies the funds are frozen, and lifting it releases them: the two are the
      // same control from the operator's point of view, and leaving a hold behind after an
      // unban would strand a balance with no reason on file.
      await tx.wallet.updateMany({
        where: { userId: target.id },
        data: { blocked: ban, blockedReason: ban ? reason : null, blockedAt: ban ? appliedAt : null },
      });
      await tx.notification.create({
        data: {
          userId: target.id,
          title: ban ? "Account banned" : "Ban lifted",
          body: ban
            ? `This account is banned: sign-in is refused and the balance is frozen (${reason}). Contact support to discuss the case.`
            : "The ban has been lifted. Sign-in and movement are available again, and the balance was never touched.",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: ban ? "account.banned" : "account.unbanned",
          subject: target.id,
          detail: ban ? reason : "ban lifted",
        },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) redirect("/admin/withdrawals?ban=duplicate");
    redirect("/admin/withdrawals?ban=error");
  }

  revalidatePath("/admin/withdrawals");
  redirect(`/admin/withdrawals?ban=${ban ? "banned" : "unbanned"}`);
}
