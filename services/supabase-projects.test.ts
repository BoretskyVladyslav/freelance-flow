import { describe, expect, it, vi } from "vitest";
import {
  isTaxModelSchemaCacheError,
  resolveRowTaxModel,
  stripTaxModelFromRows,
  transactionToRow,
  writeProjectsWithTaxModelFallback,
} from "@/services/supabase-projects";
import type { Transaction } from "@/types/finance";

const transaction: Transaction = {
  id: "tx_1",
  title: "Landing",
  platform: "Direct Client",
  grossAmount: 1000,
  currency: "EUR",
  customFee: 0,
  exchangeRateAtCreation: 1,
  date: "2026-09-29",
  status: "Paid",
  weekNumber: 40,
};

describe("resolveRowTaxModel", () => {
  it("falls back to spain_19 for undefined, null, or unknown values", () => {
    expect(resolveRowTaxModel(undefined)).toBe("spain_19");
    expect(resolveRowTaxModel(null)).toBe("spain_19");
    expect(resolveRowTaxModel("")).toBe("spain_19");
    expect(resolveRowTaxModel("vat_20")).toBe("spain_19");
    expect(resolveRowTaxModel("spain_19")).toBe("spain_19");
  });

  it("keeps fop_3 when present", () => {
    expect(resolveRowTaxModel("fop_3")).toBe("fop_3");
    expect(resolveRowTaxModel("fop_3" as const)).toBe("fop_3");
  });
});

describe("transactionToRow", () => {
  it("writes spain_19 when tax_model is missing", () => {
    expect(transactionToRow(transaction, "user_1").tax_model).toBe("spain_19");
  });

  it("writes fop_3 when the transaction uses that model", () => {
    expect(transactionToRow({ ...transaction, tax_model: "fop_3" }, "user_1").tax_model).toBe(
      "fop_3",
    );
  });
});

describe("isTaxModelSchemaCacheError", () => {
  it("detects PostgREST schema-cache misses", () => {
    expect(
      isTaxModelSchemaCacheError({
        code: "PGRST204",
        message: "Could not find the 'tax_model' column of 'projects' in the schema cache",
      }),
    ).toBe(true);
  });

  it("detects Postgres undefined_column for tax_model", () => {
    expect(
      isTaxModelSchemaCacheError({
        code: "42703",
        message: 'column "tax_model" does not exist',
      }),
    ).toBe(true);
  });

  it("ignores unrelated write errors", () => {
    expect(
      isTaxModelSchemaCacheError({
        code: "42501",
        message: "permission denied for table projects",
      }),
    ).toBe(false);
    expect(isTaxModelSchemaCacheError(null)).toBe(false);
  });
});

function firstWrittenRow(write: ReturnType<typeof vi.fn>, callIndex: number) {
  const call = write.mock.calls[callIndex] as unknown as [Array<Record<string, unknown>>] | undefined;
  return call?.[0]?.[0];
}

describe("writeProjectsWithTaxModelFallback", () => {
  it("does not retry a successful write", async () => {
    const write = vi.fn(async () => ({ error: null }));
    const rows = [transactionToRow(transaction, "user_1")];
    await writeProjectsWithTaxModelFallback(write, rows);
    expect(write).toHaveBeenCalledTimes(1);
    expect(firstWrittenRow(write, 0)).toHaveProperty("tax_model", "spain_19");
  });

  it("strips tax_model and retries on PGRST204 instead of crashing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const write = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          code: "PGRST204",
          message: "Could not find the 'tax_model' column of 'projects' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });

    const rows = [transactionToRow({ ...transaction, tax_model: "fop_3" }, "user_1")];
    await writeProjectsWithTaxModelFallback(write, rows);

    expect(write).toHaveBeenCalledTimes(2);
    expect(firstWrittenRow(write, 0)).toHaveProperty("tax_model", "fop_3");
    expect(firstWrittenRow(write, 1)).not.toHaveProperty("tax_model");
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/PGRST204/);
    warn.mockRestore();
  });

  it("rethrows errors that are not a tax_model schema-cache miss", async () => {
    const write = vi.fn(async () => ({
      error: { code: "42501", message: "permission denied for table projects" },
    }));
    await expect(
      writeProjectsWithTaxModelFallback(write, [transactionToRow(transaction, "user_1")]),
    ).rejects.toThrow(/permission denied/);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe("stripTaxModelFromRows", () => {
  it("removes tax_model from an otherwise intact payload", () => {
    const [row] = stripTaxModelFromRows([transactionToRow(transaction, "user_1")]);
    expect(row).not.toHaveProperty("tax_model");
    expect(row.title).toBe("Landing");
  });
});
