import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
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
