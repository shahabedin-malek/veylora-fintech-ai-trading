import { describe, expect, it } from "vitest";

import { centsToDecimal, csvEscape, ledgerCsv, toCsv, transactionsCsv } from "@/lib/export";

/**
 * CSV export must survive a spreadsheet: fields with commas, quotes and newlines are
 * quoted and their quotes doubled (RFC 4180), and amounts are plain signed decimals —
 * a `$`-formatted figure would import as text.
 */

describe("csvEscape", () => {
  it("leaves a plain value untouched", () => {
    expect(csvEscape("BTC")).toBe("BTC");
    expect(csvEscape(1234)).toBe("1234");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and ends with a trailing newline", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("a,b\r\n1,2\r\n");
  });
});

describe("centsToDecimal", () => {
  it("renders signed decimals", () => {
    expect(centsToDecimal(1234)).toBe("12.34");
    expect(centsToDecimal(-50)).toBe("-0.50");
    expect(centsToDecimal(0)).toBe("0.00");
  });
});

describe("transactionsCsv", () => {
  it("emits a header plus one row per transaction, quoting a comma-bearing detail", () => {
    const csv = transactionsCsv([
      {
        createdAt: new Date("2026-10-10T09:00:00.000Z"),
        kind: "DEPOSIT",
        detail: "Coinbase deposit, USDC",
        status: "COMPLETED",
        amountCents: 5000,
      },
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("Date,Kind,Detail,Status,Amount (USD),Amount (cents)");
    expect(lines[1]).toBe('2026-10-10T09:00:00.000Z,DEPOSIT,"Coinbase deposit, USDC",COMPLETED,50.00,5000');
  });

  it("still emits the header when there are no rows", () => {
    expect(transactionsCsv([])).toBe("Date,Kind,Detail,Status,Amount (USD),Amount (cents)\r\n");
  });
});

describe("ledgerCsv", () => {
  it("carries the reference column and signed amounts", () => {
    const csv = ledgerCsv([
      {
        createdAt: new Date("2026-10-10T09:00:00.000Z"),
        type: "WITHDRAWAL",
        note: "held for approval",
        amountCents: -2500,
        ref: "req_123",
      },
    ]);
    const line = csv.trimEnd().split("\r\n")[1];
    expect(line).toBe("2026-10-10T09:00:00.000Z,WITHDRAWAL,held for approval,req_123,-25.00,-2500");
  });
});
