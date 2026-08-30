import { describe, expect, it } from "vitest";
import { applyFilters, summarize, withBreakdowns } from "@/lib/aggregates";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { convertToDisplay } from "@/lib/tax-calculator";
import {
  buildPdfTableRows,
  describeFilterRange,
  pdfFileName,
} from "@/lib/pdf-report";
import { DEFAULT_FILTERS, type Transaction } from "@/types/finance";

const usd: Transaction = {
  id: "tx_1",
  title: "Landing",
  platform: "Freelancehunt",
  grossAmount: 1000,
  currency: "USD",
  customFee: 50,
  exchangeRateAtCreation: 0.9,
  date: "2026-08-01",
  startDate: "2026-08-01",
  status: "Paid",
  weekNumber: 31,
};

const uah: Transaction = {
  id: "tx_2",
  title: "CRM",
  platform: "Freelance BG",
  grossAmount: 10000,
  currency: "UAH",
  customFee: 0,
  exchangeRateAtCreation: 0.022,
  date: "2026-07-15",
  startDate: "2026-07-15",
  status: "Pending",
  weekNumber: 29,
};

describe("describeFilterRange", () => {
  it("labels an unfiltered range", () => {
    expect(describeFilterRange(DEFAULT_FILTERS)).toBe(
      "All platforms · All statuses · All months · All weeks",
    );
  });

  it("includes selected platform, status, month and week", () => {
    expect(
      describeFilterRange({
        platform: "Freelancehunt",
        status: "Paid",
        month: "2026-08",
        week: "2026-W31",
      }),
    ).toBe("Freelancehunt · Виплачено · 2026-08 · 2026 W31");
  });
});

describe("pdfFileName", () => {
  it("uses the FreelanceFlow_Report_[Date] pattern", () => {
    expect(pdfFileName(new Date("2026-08-30T12:00:00.000Z"))).toBe(
      "FreelanceFlow_Report_2026-08-30.pdf",
    );
  });
});

describe("filtered PDF totals", () => {
  const views = withBreakdowns([usd, uah], LAST_RESORT_RATES);

  it("matches header KPIs to the filtered project list", () => {
    const filtered = applyFilters(views, {
      ...DEFAULT_FILTERS,
      platform: "Freelancehunt",
    });
    const totals = summarize(filtered);
    expect(filtered).toHaveLength(1);
    expect(totals.grossInBase).toBe(filtered[0].breakdown.grossInBase);
    expect(totals.spainTax).toBe(filtered[0].breakdown.spainTax);
    expect(totals.companyTax).toBe(filtered[0].breakdown.companyTax);
    expect(totals.netPayout).toBe(filtered[0].breakdown.netPayout);
    expect(totals.netPayout).not.toBe(0);
  });

  it("builds one table row per filtered transaction with converted net", () => {
    const filtered = applyFilters(views, { ...DEFAULT_FILTERS, status: "Paid" });
    const rows = buildPdfTableRows(filtered, "UAH", LAST_RESORT_RATES);
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Landing");
    expect(rows[0][6]).toMatch(/\d/);
    const net = convertToDisplay(filtered[0].breakdown.netPayout, "UAH", LAST_RESORT_RATES);
    expect(net).toBeGreaterThan(0);
  });
});
