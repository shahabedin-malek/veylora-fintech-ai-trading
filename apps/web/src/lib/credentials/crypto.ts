/**
 * Credential encryption — the only place a stored provider key is turned back into
 * plaintext, and only in server memory.
 *
 * Admin-added keys live in the database encrypted with **AES-256-GCM** under
 * `CREDENTIAL_ENCRYPTION_KEY`. The key is read from the environment at call time, used,
 * and never returned, logged or rendered. If the variable is unset the credential store
 * is **disabled** (fail closed): the app falls back to env-only keys rather than storing
 * plaintext. A value that cannot be decrypted (e.g. after a key rotation) is skipped,
 * never guessed at.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The env var holding the encryption key. */
export const CREDENTIAL_ENCRYPTION_ENV = "CREDENTIAL_ENCRYPTION_KEY";

/** Thrown when encryption is unavailable or a payload cannot be decrypted. */
export class CredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialCryptoError";
  }
}

/**
 * The 32-byte AES key, or `null` when unset. Accepts a 64-char hex key, a base64 key that
 * decodes to exactly 32 bytes, or any other non-empty string (hashed to 32 bytes with
 * SHA-256, so a passphrase works — entropy is the operator's responsibility).
 */
function encryptionKey(): Buffer | null {
  const raw = (process.env[CREDENTIAL_ENCRYPTION_ENV] ?? "").trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Whether stored credentials can be read/written on this deployment. */
export function credentialEncryptionAvailable(): boolean {
  return encryptionKey() !== null;
}

/** Encrypt a field map. Returns base64(iv | tag | ciphertext). */
export function encryptSecret(fields: Record<string, string>): string {
  const key = encryptionKey();
  if (!key) throw new CredentialCryptoError(`${CREDENTIAL_ENCRYPTION_ENV} is not set.`);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(fields), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Decrypt a payload produced by `encryptSecret`. Throws on tampering or a wrong key. */
export function decryptSecret(payload: string): Record<string, string> {
  const key = encryptionKey();
  if (!key) throw new CredentialCryptoError(`${CREDENTIAL_ENCRYPTION_ENV} is not set.`);
  const buf = Buffer.from(payload, "base64");
  if (buf.length <= IV_BYTES + TAG_BYTES) throw new CredentialCryptoError("credential payload is malformed");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== "object") throw new CredentialCryptoError("credential payload is not an object");
  return parsed as Record<string, string>;
}

/**
 * A non-reversible fingerprint of a field map, shown only so an operator can tell two
 * keys apart. It is safe to render — several orders of magnitude cheaper to brute-force
 * than the key it identifies is unlikely to be a random API secret.
 */
export function fingerprintOf(fields: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex").slice(0, 12);
}
