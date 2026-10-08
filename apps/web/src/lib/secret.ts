/**
 * Session-secret resolution.
 *
 * A weak or absent secret must never be used to sign sessions in production,
 * so this throws there rather than silently falling back. Outside production a
 * documented development fallback keeps the app runnable for local work.
 *
 * Kept free of framework imports so it can be unit tested directly.
 */
export const MIN_SECRET_LENGTH = 16;

const DEV_FALLBACK = "insecure-development-secret-change-me";

export function getSessionSecret(): string {
  const value = process.env.SESSION_SECRET;

  if (value && value.length >= MIN_SECRET_LENGTH) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production`
    );
  }

  return DEV_FALLBACK;
}

/** True when sessions are being signed with the insecure development fallback. */
export function isUsingInsecureFallback(): boolean {
  const value = process.env.SESSION_SECRET;
  return !value || value.length < MIN_SECRET_LENGTH;
}
