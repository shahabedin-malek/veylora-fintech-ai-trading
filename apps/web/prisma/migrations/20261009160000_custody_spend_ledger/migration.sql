-- Persisted rolling custody spend ledger (PHASE18-004).
--
-- Every real movement signed through the custody boundary is recorded here, so the
-- daily cap is derived from what actually moved rather than from a caller-supplied
-- total. `address` is the custody signer's public address (never key material).

-- CreateTable
CREATE TABLE "CustodySpend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "ref" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustodySpend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustodySpend_userId_createdAt_idx" ON "CustodySpend"("userId", "createdAt");
