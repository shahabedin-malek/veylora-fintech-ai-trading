-- Per-key usage counter for the provider key pool (see `src/lib/credentials/`), so an
-- operator can see how often each key has been used successfully alongside failures.
-- AlterTable
ALTER TABLE "ProviderCredential" ADD COLUMN "successCount" INTEGER NOT NULL DEFAULT 0;
