-- Persisted signal events (see `docs/signals/`).
--
-- A signal is a read-only input: it informs the risk gate and never moves funds. The
-- unique constraint is the event's identity (the vendors supply no stable per-item id),
-- so re-fetching an overlapping window de-duplicates instead of duplicating history.
-- No foreign key: signals are desk-wide market facts, not per-user rows.

-- CreateTable
CREATE TABLE "SignalEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "priceUsd" DOUBLE PRECISION,
    "marketCapUsd" DOUBLE PRECISION,
    "changePct" DOUBLE PRECISION,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalEvent_provider_providerKey_symbol_direction_ts_key" ON "SignalEvent"("provider", "providerKey", "symbol", "direction", "ts");

-- CreateIndex
CREATE INDEX "SignalEvent_ts_idx" ON "SignalEvent"("ts");

-- CreateIndex
CREATE INDEX "SignalEvent_symbol_ts_idx" ON "SignalEvent"("symbol", "ts");
