-- Postgres counterpart of 20261010160000_dispute_window_and_ban: the dispute window on a
-- declined withdrawal request and the account ban fields.
-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN "disputeClosesAt" TIMESTAMP(3),
ADD COLUMN "disputeOpensAt" TIMESTAMP(3),
ADD COLUMN "disputeOutcome" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bannedReason" TEXT,
ADD COLUMN "bannedAt" TIMESTAMP(3);
