import { describe, expect, it, vi } from "vitest";
import {
  isTaxModelSchemaCacheError,
  isUahAmountSchemaCacheError,
  resolveRowTaxModel,
  stripTaxModelFromRows,
  stripUahAmountsFromRows,
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
  it("honors an explicit stored model and infers FOP after the September 2026 cutover", () => {
    expect(resolveRowTaxModel("fop_3", { startDate: "2026-08-01" })).toBe("fop_3");
    expect(resolveRowTaxModel("spain_19", { startDate: "2026-09-29" })).toBe("spain_19");
    expect(resolveRowTaxModel(undefined, { startDate: "2026-09-01" })).toBe("fop_3");
    expect(resolveRowTaxModel(null, { date: "2026-09-15" })).toBe("fop_3");
    expect(resolveRowTaxModel(undefined, { startDate: "2026-08-31" })).toBe("spain_19");
    expect(
      resolveRowTaxModel(undefined, {
        startDate: "2026-08-01",
        createdByEmail: "workspacetechdef@gmail.com",
      }),
    ).toBe("fop_3");
  });

  it("falls back to spain_19 for unknown values on legacy dates", () => {
    expect(resolveRowTaxModel(undefined, { startDate: "2026-08-29" })).toBe("spain_19");
    expect(resolveRowTaxModel("", { date: "2026-08-29" })).toBe("spain_19");
    expect(resolveRowTaxModel("vat_20", { startDate: "2026-08-29" })).toBe("spain_19");
  });

  it("keeps fop_3 when present", () => {
    expect(resolveRowTaxModel("fop_3")).toBe("fop_3");
    expect(resolveRowTaxModel("fop_3" as const)).toBe("fop_3");
  });
});

describe("transactionToRow", () => {
  it("writes fop_3 for post-cutover projects when tax_model is missing", () => {
    expect(transactionToRow(transaction, "user_1").tax_model).toBe("fop_3");
  });

  it("writes spain_19 for legacy pre-cutover projects when tax_model is missing", () => {
    expect(
      transactionToRow({ ...transaction, date: "2026-08-15", startDate: "2026-08-15" }, "user_1")
        .tax_model,
    ).toBe("spain_19");
  });

  it("writes fop_3 when the transaction uses that model", () => {
    expect(transactionToRow({ ...transaction, tax_model: "fop_3" }, "user_1").tax_model).toBe(
      "fop_3",
    );
  });

  it("does not override an explicit fop_3 on a legacy date", () => {
    expect(
      transactionToRow(
        { ...transaction, date: "2026-08-15", startDate: "2026-08-15", tax_model: "fop_3" },
        "user_1",
      ).tax_model,
    ).toBe("fop_3");
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
    expect(
      isTaxModelSchemaCacheError({
        code: "PGRST204",
        message: "Could not find the 'gross_uah' column of 'projects' in the schema cache",
      }),
    ).toBe(false);
  });
});

describe("isUahAmountSchemaCacheError", () => {
  it("detects UAH column schema-cache misses without treating them as tax_model errors", () => {
    const error = {
      code: "PGRST204",
      message: "Could not find the 'gross_uah' column of 'projects' in the schema cache",
    };
    expect(isUahAmountSchemaCacheError(error)).toBe(true);
    expect(isTaxModelSchemaCacheError(error)).toBe(false);
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
    expect(firstWrittenRow(write, 0)).toHaveProperty("tax_model", "fop_3");
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

  it("strips UAH columns on PGRST204 while keeping tax_model", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const write = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          code: "PGRST204",
          message: "Could not find the 'gross_uah' column of 'projects' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });

    const rows = [
      transactionToRow(
        {
          ...transaction,
          tax_model: "fop_3",
          uahRateAtCreation: 45.5,
          gross_uah: 45500,
          net_uah: 25000,
        },
        "user_1",
      ),
    ];
    await writeProjectsWithTaxModelFallback(write, rows);

    expect(write).toHaveBeenCalledTimes(2);
    expect(firstWrittenRow(write, 0)).toHaveProperty("tax_model", "fop_3");
    expect(firstWrittenRow(write, 0)).toHaveProperty("gross_uah", 45500);
    expect(firstWrittenRow(write, 1)).toHaveProperty("tax_model", "fop_3");
    expect(firstWrittenRow(write, 1)).not.toHaveProperty("gross_uah");
    expect(firstWrittenRow(write, 1)).not.toHaveProperty("net_uah");
    expect(firstWrittenRow(write, 1)).not.toHaveProperty("uah_rate_at_creation");
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/UAH/);
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
    const [row] = stripTaxModelFromRows([
      transactionToRow(
        { ...transaction, tax_model: "fop_3", gross_uah: 1000, net_uah: 600, uahRateAtCreation: 41 },
        "user_1",
      ),
    ]);
    expect(row).not.toHaveProperty("tax_model");
    expect(row.title).toBe("Landing");
    expect(row).toHaveProperty("gross_uah", 1000);
  });
});

describe("stripUahAmountsFromRows", () => {
  it("removes UAH snapshot fields while keeping tax_model", () => {
    const [row] = stripUahAmountsFromRows([
      transactionToRow(
        { ...transaction, tax_model: "fop_3", gross_uah: 1000, net_uah: 600, uahRateAtCreation: 41 },
        "user_1",
      ),
    ]);
    expect(row.tax_model).toBe("fop_3");
    expect(row).not.toHaveProperty("gross_uah");
    expect(row).not.toHaveProperty("net_uah");
    expect(row).not.toHaveProperty("uah_rate_at_creation");
  });
});
