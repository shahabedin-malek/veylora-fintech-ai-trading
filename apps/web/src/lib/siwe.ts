import { randomBytes } from "node:crypto";
import { ParsedMessage } from "@spruceid/siwe-parser";
import { getAddress, verifyMessage } from "viem";
import { prisma } from "@/lib/db";

/**
 * Server-side SIWE (EIP-4361) verification.
 *
 * Signature recovery is done with **viem** — the same library the wallet stack
 * uses — rather than the `siwe` package, which would pull in `ethers` purely to
 * recover an address.
 *
 * Three independent checks must all pass before a session is issued:
 *   1. the message parses and names *this* domain (anti-phishing),
 *   2. its nonce is one the server issued, unexpired and unused (anti-replay),
 *   3. the signature recovers the address the message claims (authenticity).
 */

export const NONCE_TTL_MS = 5 * 60 * 1000;
export const NONCE_BYTES = 16;

/** Issues a single-use nonce, opportunistically clearing expired ones. */
export async function issueNonce(now = new Date()): Promise<string> {
  const nonce = randomBytes(NONCE_BYTES).toString("hex");
  await prisma.$transaction([
    prisma.authNonce.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.authNonce.create({
      data: { nonce, expiresAt: new Date(now.getTime() + NONCE_TTL_MS) },
    }),
  ]);
  return nonce;
}

export type SiweResult =
  | { ok: true; address: string; chainId: number }
  | { ok: false; reason: string };

/**
 * Verifies a signed SIWE message. Returns a lower-cased address on success.
 * The nonce is consumed before the signature is checked, so a failed attempt
 * cannot be retried with the same nonce.
 */
export async function verifySiwe(
  message: string,
  signature: string,
  expected: { domain: string; now?: Date }
): Promise<SiweResult> {
  const now = expected.now ?? new Date();

  let parsed: ParsedMessage;
  try {
    parsed = new ParsedMessage(message);
  } catch {
    return { ok: false, reason: "That sign-in message is malformed." };
  }

  if (parsed.version !== "1") {
    return { ok: false, reason: "Unsupported sign-in message version." };
  }

  if (parsed.domain.toLowerCase() !== expected.domain.toLowerCase()) {
    return { ok: false, reason: "The message was not issued for this site." };
  }

  // Atomic single-use consume: exactly one caller can win this update, which is
  // what makes a captured message unreplayable.
  const consumed = await prisma.authNonce.updateMany({
    where: { nonce: parsed.nonce, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    return { ok: false, reason: "This sign-in request has expired. Please try again." };
  }

  if (parsed.expirationTime && new Date(parsed.expirationTime).getTime() < now.getTime()) {
    return { ok: false, reason: "This sign-in request has expired. Please try again." };
  }

  if (!Number.isInteger(parsed.chainId) || parsed.chainId <= 0) {
    return { ok: false, reason: "The message does not name a network." };
  }

  let address: `0x${string}`;
  try {
    address = getAddress(parsed.address);
  } catch {
    return { ok: false, reason: "The message contains an invalid address." };
  }

  try {
    const valid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return { ok: false, reason: "The signature does not match that wallet." };
  } catch {
    return { ok: false, reason: "That signature could not be verified." };
  }

  return { ok: true, address: address.toLowerCase(), chainId: parsed.chainId };
}
