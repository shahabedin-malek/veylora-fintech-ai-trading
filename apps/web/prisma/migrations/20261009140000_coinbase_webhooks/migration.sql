-- Coinbase webhook ingestion (PHASE19-006).
--
-- Every verified delivery is recorded once and de-duplicated by `eventId`, so a
-- replayed delivery (Coinbase retries, concurrent delivery) is a no-op rather than a
-- second credit. When an event warrants a ledger movement it is applied in the same
-- transaction as the status update in `src/lib/coinbase/ingest.ts`.
--
-- No foreign key to "User": an event that matches no app user is stored with a null
-- `userId` and credits nothing, so the row must outlive any single account.

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'coinbase',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "userId" TEXT,
    "payload" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_receivedAt_idx" ON "WebhookEvent"("eventType", "receivedAt");
