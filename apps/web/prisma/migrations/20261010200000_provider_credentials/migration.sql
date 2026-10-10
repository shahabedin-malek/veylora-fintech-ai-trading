-- Admin-managed provider API keys (the key pool). See `src/lib/credentials/`.
--
-- Several keys per provider let the resolver rotate to a backup when one is
-- rate-limited or exhausted. `secret` holds the field map encrypted at rest with
-- AES-256-GCM; the plaintext key is never stored, rendered or logged. `fingerprint`
-- is a non-reversible hash so an operator can distinguish two keys without seeing
-- either. Failover state (`status`, `failureCount`, `cooldownUntil`) lives here.

-- CreateTable
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "cooldownUntil" DATETIME,
    "lastUsedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ProviderCredential_provider_enabled_priority_idx" ON "ProviderCredential"("provider", "enabled", "priority");
