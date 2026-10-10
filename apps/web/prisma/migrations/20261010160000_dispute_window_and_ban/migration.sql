-- A declined withdrawal request opens a dispute window (business days) during which the
-- user can argue the case in the support chat, and an account can be banned (sign-in
-- refused). Generated with `prisma migrate diff` for this exact schema.
-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN "disputeClosesAt" DATETIME;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "disputeOpensAt" DATETIME;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "disputeOutcome" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "bannedReason" TEXT,
    "bannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("chainId", "createdAt", "id", "name", "role", "walletAddress") SELECT "chainId", "createdAt", "id", "name", "role", "walletAddress" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
