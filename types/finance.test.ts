import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  getTransactionStartDate,
  parseBackup,
  type BackupEnvelope,
  type Transaction,
} from "@/types/finance";

const validTransaction: Transaction = {
  id: "tx_1",
  title: "Landing page",
  platform: "Direct Client",
  grossAmount: 1000,
  currency: "USD",
  customFee: 50,
  exchangeRateAtCreation: 0.9,
  date: "2026-08-29",
  status: "Paid",
  weekNumber: 35,
  notes: "Milestone 1",
};

describe("parseBackup", () => {
  it("keeps legacy date-only records valid and uses date as start fallback", () => {
    const parsed = parseBackup({
      version: 1,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [validTransaction],
    });

    expect(parsed.transactions[0]).not.toHaveProperty("startDate");
    expect(getTransactionStartDate(parsed.transactions[0])).toBe("2026-08-29");
  });

  it("accepts optional project lifecycle dates", () => {
    const transaction = {
      ...validTransaction,
      startDate: "2026-08-20",
      endDate: "2026-08-28",
      payoutDate: "2026-08-29",
    };

    const parsed = parseBackup({
      version: 1,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [transaction],
    });

    expect(getTransactionStartDate(parsed.transactions[0])).toBe("2026-08-20");
    expect(parsed.transactions[0].payoutDate).toBe("2026-08-29");
  });

  it("accepts optional client references without changing legacy records", () => {
    const transaction = {
      ...validTransaction,
      clientId: "client_42",
      clientName: "Acme Studio",
    };
    const parsed = parseBackup({
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [transaction],
    });

    expect(parsed.transactions[0].clientId).toBe("client_42");
    expect(parsed.transactions[0].clientName).toBe("Acme Studio");
  });

  it("accepts a versioned envelope with valid transactions", () => {
    const backup: BackupEnvelope = {
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [validTransaction],
      displayCurrency: "UAH",
    };

    expect(parseBackup(backup).transactions).toHaveLength(1);
    expect(parseBackup(backup).displayCurrency).toBe("UAH");
  });

  it("rejects a missing transactions array", () => {
    expect(() => parseBackup({ version: 1 })).toThrow(/transactions array/);
  });

  it("rejects an invalid platform", () => {
    expect(() =>
      parseBackup({
        version: 1,
        exportedAt: "2026-08-29T10:00:00.000Z",
        transactions: [{ ...validTransaction, platform: "Upwork" }],
      }),
    ).toThrow(/index 0/);
  });

  it("rejects a non-positive exchange rate", () => {
    expect(() =>
      parseBackup({
        version: 1,
        exportedAt: "2026-08-29T10:00:00.000Z",
        transactions: [{ ...validTransaction, exchangeRateAtCreation: 0 }],
      }),
    ).toThrow(/index 0/);
  });

  it("rejects an out-of-range week number", () => {
    expect(() =>
      parseBackup({
        version: 1,
        exportedAt: "2026-08-29T10:00:00.000Z",
        transactions: [{ ...validTransaction, weekNumber: 54 }],
      }),
    ).toThrow(/index 0/);
  });

  it("rejects malformed optional lifecycle dates", () => {
    expect(() =>
      parseBackup({
        version: 1,
        exportedAt: "2026-08-29T10:00:00.000Z",
        transactions: [{ ...validTransaction, startDate: "not-a-date" }],
      }),
    ).toThrow(/index 0/);
  });

  it("rejects invalid lastKnownRates", () => {
    expect(() =>
      parseBackup({
        version: 1,
        exportedAt: "2026-08-29T10:00:00.000Z",
        transactions: [],
        lastKnownRates: { base: "USD", fetchedAt: "now", toEur: {} },
      }),
    ).toThrow(/lastKnownRates/);
  });
});
