-- Postgres counterpart of 20261010210000_credential_usage: per-key usage counter.
-- AlterTable
ALTER TABLE "ProviderCredential" ADD COLUMN "successCount" INTEGER NOT NULL DEFAULT 0;
