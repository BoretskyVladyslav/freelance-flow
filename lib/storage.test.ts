import { describe, expect, it } from "vitest";
import { migrateSnapshot } from "@/lib/storage";
import { BACKUP_SCHEMA_VERSION, type Transaction } from "@/types/finance";

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
};

describe("migrateSnapshot", () => {
  it("keeps the transactions array when bumping v1 to the current schema", () => {
    const snapshot = migrateSnapshot({
      schemaVersion: 1,
      transactions: [validTransaction],
      displayCurrency: "EUR",
    });

    expect(BACKUP_SCHEMA_VERSION).toBe(3);
    expect(snapshot.transactions).toHaveLength(1);
    expect(snapshot.transactions[0].id).toBe("tx_1");
    expect(snapshot.displayCurrency).toBe("UAH");
  });

  it("keeps the array and EUR display currency when bumping v2 to v3", () => {
    const snapshot = migrateSnapshot({
      schemaVersion: 2,
      transactions: [validTransaction],
      displayCurrency: "EUR",
    });

    expect(snapshot.transactions).toHaveLength(1);
    expect(snapshot.displayCurrency).toBe("EUR");
  });

  it("keeps valid rows that include unknown extra fields", () => {
    const snapshot = migrateSnapshot({
      schemaVersion: 2,
      transactions: [{ ...validTransaction, extraLegacy: "keep-row" }],
    });

    expect(snapshot.transactions).toHaveLength(1);
    expect(snapshot.transactions[0].title).toBe("Landing page");
  });

  it("does not invent an empty wipe when the stored value is a non-empty array of valid rows", () => {
    const snapshot = migrateSnapshot({
      schemaVersion: 0,
      transactions: [validTransaction, { ...validTransaction, id: "tx_2" }],
    });

    expect(snapshot.transactions).toHaveLength(2);
  });

  it("uses an empty list only when the stored value is missing or not an array", () => {
    expect(migrateSnapshot({ schemaVersion: 3 }).transactions).toEqual([]);
    expect(migrateSnapshot({ schemaVersion: 3, transactions: null }).transactions).toEqual([]);
  });
});
