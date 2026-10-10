-- Wallet-based authentication replaces email/password (SIWE / EIP-4361).
--
-- BREAKING, and intentionally so: `email` + `passwordHash` are dropped and
-- `walletAddress` is required with no default, so existing accounts cannot be
-- carried across. Deployments start from an empty database and run
-- `migrate deploy` + `db:seed`. Rationale: .progress/DECISIONS.md (D30) and
-- docs/NETWORK_BOUNDARY.md.

-- DropIndex
DROP INDEX "User_email_key";

-- Existing accounts cannot be mapped to wallets (there is no email -> address
-- mapping), and `walletAddress` is required. Clear the identity data first;
-- every dependent row cascades (Wallet, Customer, LedgerEntry, Portfolio,
-- TradingSession -> TradeEvent, Transaction, Notification, Ticket ->
-- TicketMessage) and SET NULL for Ticket.assigneeId / AuditLog.actorId.
-- `db:seed` recreates the sample accounts.
DELETE FROM "User";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash",
DROP COLUMN "email",
ADD COLUMN "walletAddress" TEXT NOT NULL,
ADD COLUMN "chainId" INTEGER;

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuthNonce" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "address" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AuthNonce_nonce_key" ON "AuthNonce"("nonce");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");
