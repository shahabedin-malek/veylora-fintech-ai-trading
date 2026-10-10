-- Postgres counterpart of 20261010120000_wallet_defaults_mainnet: the Wallet defaults
-- still named the retired `simulated`/`TESTNET` vocabulary. Nothing relies on them
-- (every write sets `kind`/`network` explicitly) — a default wallet is mainnet, and
-- practice chains are `SANDBOX`.
-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "network" SET DEFAULT 'mainnet',
ALTER COLUMN "kind" SET DEFAULT 'MAINNET';
