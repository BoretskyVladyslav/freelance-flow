import { describe, expect, it } from "vitest";
import { withBreakdowns } from "@/lib/aggregates";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import {
  describeTelegramPeriod,
  formatEmployeePeriodTelegram,
  formatTransactionTelegram,
  projectsForPeriodSummary,
} from "@/lib/telegram-copy";
import { DEFAULT_FILTERS, type Transaction } from "@/types/finance";

const usd: Transaction = {
  id: "tx_1",
  title: "Landing",
  clientName: "Acme",
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

const eur: Transaction = {
  id: "tx_2",
  title: "CRM",
  platform: "Direct Client",
  grossAmount: 200,
  currency: "EUR",
  customFee: 0,
  exchangeRateAtCreation: 1,
  date: "2026-08-03",
  startDate: "2026-08-03",
  status: "Pending",
  weekNumber: 32,
};

const inProgress: Transaction = {
  id: "tx_3",
  title: "Draft",
  platform: "Other",
  grossAmount: 50,
  currency: "EUR",
  customFee: 0,
  exchangeRateAtCreation: 1,
  date: "2026-08-04",
  startDate: "2026-08-04",
  status: "In Progress",
  weekNumber: 32,
};

describe("formatTransactionTelegram", () => {
  it("formats a USD project in original currency with client", () => {
    const [view] = withBreakdowns([usd], LAST_RESORT_RATES);
    const text = formatTransactionTelegram(view);

    expect(text).toBe(
      [
        "📋 Проєкт: Landing",
        "👤 Клієнт: Acme",
        "━━━━━━━━━━━━━━━━━━",
        "💰 Валовий (Gross): 1 000,00 USD",
        "🏛 Податок Іспанії (19%): -180,50 USD",
        "🏢 Комісія фірми (30%): -230,86 USD",
        "━━━━━━━━━━━━━━━━━━",
        "✅ До виплати (Net): 538,64 USD",
      ].join("\n"),
    );
  });

  it("omits the client line when missing", () => {
    const [view] = withBreakdowns([eur], LAST_RESORT_RATES);
    const text = formatTransactionTelegram(view);

    expect(text.startsWith("📋 Проєкт: CRM\n━━━━━━━━━━━━━━━━━━\n")).toBe(true);
    expect(text).toContain("💰 Валовий (Gross): 200,00 EUR");
    expect(text).toContain("🏛 Податок Іспанії (19%): -38,00 EUR");
    expect(text).toContain("🏢 Комісія фірми (30%): -48,60 EUR");
    expect(text).toContain("✅ До виплати (Net): 113,40 EUR");
    expect(text).not.toContain("Клієнт");
  });

  it("formats FOP tax for a fop_3 project with fee first, then tax on the remainder", () => {
    const [view] = withBreakdowns([{ ...usd, tax_model: "fop_3" }], LAST_RESORT_RATES);
    const text = formatTransactionTelegram(view);

    expect(text).toContain("🏢 Комісія фірми (30%): -285,00 USD");
    expect(text).toContain("🏛 Податки ФОП (5% ЄП + 1% ВЗ): -39,90 USD");
    expect(text).toContain("✅ До виплати (Net): 625,10 USD");
    expect(text).not.toContain("Податок Іспанії");
    const companyIndex = text.indexOf("Комісія фірми");
    const taxIndex = text.indexOf("Податки ФОП");
    expect(companyIndex).toBeGreaterThan(-1);
    expect(taxIndex).toBeGreaterThan(companyIndex);
  });
});

describe("describeTelegramPeriod", () => {
  it("prefers week, then month, then all periods", () => {
    expect(describeTelegramPeriod({ ...DEFAULT_FILTERS, week: "2026-W31" })).toContain(
      "Тиждень",
    );
    expect(describeTelegramPeriod({ ...DEFAULT_FILTERS, month: "2026-08" })).toBe(
      "Серпень 2026",
    );
    expect(describeTelegramPeriod(DEFAULT_FILTERS)).toBe("Усі періоди");
  });
});

describe("projectsForPeriodSummary", () => {
  it("drops in-progress rows when completed work exists", () => {
    const views = withBreakdowns([usd, inProgress], LAST_RESORT_RATES);
    expect(projectsForPeriodSummary(views).map((row) => row.id)).toEqual(["tx_1"]);
  });

  it("keeps in-progress rows when that is the whole set", () => {
    const views = withBreakdowns([inProgress], LAST_RESORT_RATES);
    expect(projectsForPeriodSummary(views)).toHaveLength(1);
  });
});

describe("formatEmployeePeriodTelegram", () => {
  it("itemizes completed projects and totals net in display currency", () => {
    const views = withBreakdowns([usd, eur, inProgress], LAST_RESORT_RATES);
    const text = formatEmployeePeriodTelegram({
      employeeLabel: "Іван Петренко",
      email: "ivan@example.com",
      filters: { ...DEFAULT_FILTERS, week: "2026-W31" },
      views,
      displayCurrency: "EUR",
      rates: LAST_RESORT_RATES,
    });

    expect(text).toContain("📋 Підсумок: Іван Петренко");
    expect(text).toContain("✉️ ivan@example.com");
    expect(text).toContain("📊 Проєктів: 2");
    expect(text).toContain("1. 📋 Landing");
    expect(text).toContain("👤 Acme");
    expect(text).toContain("2. 📋 CRM");
    expect(text).not.toContain("Draft");
    expect(text).toMatch(/✅ Разом до виплати \(Net\): [\d\s,]+ EUR/);
    expect(text).not.toContain("Резерв ЄСВ");
  });

  it("adds the monthly ESV reserve when a month is selected", () => {
    const views = withBreakdowns([usd, eur], LAST_RESORT_RATES);
    const text = formatEmployeePeriodTelegram({
      employeeLabel: "Іван Петренко",
      filters: { ...DEFAULT_FILTERS, month: "2026-08" },
      views,
      displayCurrency: "UAH",
      rates: LAST_RESORT_RATES,
    });

    expect(text).toContain("Резерв ЄСВ за місяць: 1 760,00 грн (фіксовано 22% від МЗП)");
    expect(text).toContain("Чистий залишок після ЄСВ");
  });
});
