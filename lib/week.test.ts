import { describe, expect, it } from "vitest";
import {
  formatDateDayMonth,
  formatMonthFilterLabel,
  formatWeekFilterLabel,
  formatWeekSpan,
} from "@/lib/format";
import { isoWeekRange, weekKeyFromIsoDate } from "@/lib/week";

describe("isoWeekRange", () => {
  it("returns Monday–Sunday for 2026-W35", () => {
    expect(isoWeekRange("2026-W35")).toEqual({
      start: "2026-08-24",
      end: "2026-08-30",
    });
  });

  it("returns a cross-month range for 2026-W36", () => {
    expect(isoWeekRange("2026-W36")).toEqual({
      start: "2026-08-31",
      end: "2026-09-06",
    });
  });

  it("round-trips from an ISO date via weekKeyFromIsoDate", () => {
    const key = weekKeyFromIsoDate("2026-08-26");
    expect(key).toBe("2026-W35");
    const range = isoWeekRange(key);
    expect(range.start <= "2026-08-26").toBe(true);
    expect(range.end >= "2026-08-26").toBe(true);
  });
});

describe("week and month labels", () => {
  it("formats a same-month week span as DD–DD MMM", () => {
    expect(formatWeekSpan("2026-W35")).toBe("24–30 серп.");
  });

  it("formats a cross-month week span with both month abbreviations", () => {
    expect(formatWeekSpan("2026-W36")).toBe("31 серп.–6 вер.");
  });

  it("formats filter week labels with year", () => {
    expect(formatWeekFilterLabel("2026-W35")).toBe("Тиждень 24–30 серп. 2026");
  });

  it("formats month filter labels with a capitalized long month", () => {
    expect(formatMonthFilterLabel("2026-09")).toBe("Вересень 2026");
  });

  it("formats a day-month date without the year", () => {
    expect(formatDateDayMonth("2026-08-29")).toBe("29 серп.");
  });
});
