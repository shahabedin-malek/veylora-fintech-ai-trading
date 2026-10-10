-- The Wallet defaults still named the retired `simulated`/`TESTNET` vocabulary.
-- No code path relies on them (every write sets `kind`/`network` explicitly), so this
-- is a vocabulary fix: a default wallet is a mainnet wallet, practice chains are
-- `SANDBOX`. SQLite cannot alter a column default in place, so Prisma's rebuild is used.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'mainnet',
    "kind" TEXT NOT NULL DEFAULT 'MAINNET',
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("address", "balanceCents", "createdAt", "id", "kind", "network", "userId") SELECT "address", "balanceCents", "createdAt", "id", "kind", "network", "userId" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
