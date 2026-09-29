import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  defaultTaxModelForCreator,
  getTaxModel,
  getTransactionStartDate,
  parseBackup,
  resolveTaxModel,
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

  it("accepts optional employee identity without changing legacy records", () => {
    const parsedLegacy = parseBackup({
      version: 1,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [validTransaction],
    });
    expect(parsedLegacy.transactions[0]).not.toHaveProperty("employeeId");
    expect(parsedLegacy.transactions[0]).not.toHaveProperty("createdBy");

    const parsed = parseBackup({
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [
        {
          ...validTransaction,
          employeeId: "emp_7",
          createdBy: "user_1",
        },
      ],
    });
    expect(parsed.transactions[0].employeeId).toBe("emp_7");
    expect(parsed.transactions[0].createdBy).toBe("user_1");
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

  it("accepts optional tax_model without changing legacy records", () => {
    const parsedLegacy = parseBackup({
      version: 1,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [validTransaction],
    });
    expect(parsedLegacy.transactions[0]).not.toHaveProperty("tax_model");
    expect(getTaxModel(parsedLegacy.transactions[0])).toBe("spain_19");

    const parsed = parseBackup({
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [{ ...validTransaction, tax_model: "fop_3" }],
    });
    expect(parsed.transactions[0].tax_model).toBe("fop_3");
  });

  it("rejects an invalid tax_model", () => {
    expect(() =>
      parseBackup({
        version: 1,
        exportedAt: "2026-08-29T10:00:00.000Z",
        transactions: [{ ...validTransaction, tax_model: "vat_20" }],
      }),
    ).toThrow(/index 0/);
  });

  it("accepts optional locked UAH amounts without changing legacy records", () => {
    const parsedLegacy = parseBackup({
      version: 1,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [validTransaction],
    });
    expect(parsedLegacy.transactions[0]).not.toHaveProperty("gross_uah");

    const parsed = parseBackup({
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: "2026-08-29T10:00:00.000Z",
      transactions: [
        {
          ...validTransaction,
          uahRateAtCreation: 41.81818182,
          gross_uah: 41818.18,
          net_uah: 25000,
        },
      ],
    });
    expect(parsed.transactions[0].gross_uah).toBe(41818.18);
    expect(parsed.transactions[0].net_uah).toBe(25000);
  });
});

describe("defaultTaxModelForCreator", () => {
  it("defaults new admin projects to FOP 3", () => {
    expect(defaultTaxModelForCreator({ isAdmin: true, email: "other@example.com" })).toBe(
      "fop_3",
    );
    expect(
      defaultTaxModelForCreator({
        isAdmin: false,
        email: "workspacetechdef@gmail.com",
      }),
    ).toBe("fop_3");
  });

  it("keeps Spain 19% for non-admin creators without a cutover start date", () => {
    expect(defaultTaxModelForCreator({ isAdmin: false, email: "dev@example.com" })).toBe(
      "spain_19",
    );
  });

  it("defaults non-admin projects on or after 2026-09-01 to FOP 3", () => {
    expect(
      defaultTaxModelForCreator({
        isAdmin: false,
        email: "dev@example.com",
        startDate: "2026-09-01",
      }),
    ).toBe("fop_3");
  });
});

describe("resolveTaxModel", () => {
  it("honors an explicit stored model", () => {
    expect(resolveTaxModel({ tax_model: "fop_3", startDate: "2026-08-01" })).toBe("fop_3");
    expect(resolveTaxModel({ tax_model: "spain_19", startDate: "2026-09-29" })).toBe("spain_19");
  });

  it("infers FOP 3 from the cutover date or admin creator when the model is missing", () => {
    expect(resolveTaxModel({ startDate: "2026-09-01" })).toBe("fop_3");
    expect(resolveTaxModel({ date: "2026-08-15", createdByEmail: "workspacetechdef@gmail.com" })).toBe(
      "fop_3",
    );
    expect(resolveTaxModel({ startDate: "2026-08-31" })).toBe("spain_19");
  });
});
