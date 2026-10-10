/**
 * Account export — CSV of a user's own transactions and ledger entries.
 *
 * Pure and framework-free so the escaping is unit-testable: a field containing a comma,
 * quote or newline is quoted, and quotes are doubled (RFC 4180). Amounts are emitted as
 * plain signed decimals (not `$`-formatted) so a spreadsheet parses them as numbers.
 */

/** RFC 4180 field escaping. `null`/`undefined` become an empty field. */
export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialise a header row plus data rows to CSV (CRLF line endings). */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

/** Signed decimal for a cent amount, e.g. `-1234` → `"-12.34"`. */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface ExportTransaction {
  createdAt: Date;
  kind: string;
  detail: string | null;
  status: string;
  amountCents: number;
}

export interface ExportLedgerEntry {
  createdAt: Date;
  type: string;
  note: string | null;
  amountCents: number;
  ref?: string | null;
}

/** CSV for a user's transactions, newest first (caller supplies the order). */
export function transactionsCsv(rows: readonly ExportTransaction[]): string {
  return toCsv([
    ["Date", "Kind", "Detail", "Status", "Amount (USD)", "Amount (cents)"],
    ...rows.map((t) => [
      t.createdAt.toISOString(),
      t.kind,
      t.detail ?? "",
      t.status,
      centsToDecimal(t.amountCents),
      t.amountCents,
    ]),
  ]);
}

/** CSV for a user's ledger entries, newest first (caller supplies the order). */
export function ledgerCsv(rows: readonly ExportLedgerEntry[]): string {
  return toCsv([
    ["Date", "Type", "Note", "Reference", "Amount (USD)", "Amount (cents)"],
    ...rows.map((l) => [
      l.createdAt.toISOString(),
      l.type,
      l.note ?? "",
      l.ref ?? "",
      centsToDecimal(l.amountCents),
      l.amountCents,
    ]),
  ]);
}
