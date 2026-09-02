import { describe, expect, it } from "vitest";
import { applyEndDateChange, applyStatusChange } from "@/lib/project-automation";

describe("applyEndDateChange", () => {
  it("sets Pending when In Progress gets a completion date", () => {
    expect(applyEndDateChange("In Progress", "2026-09-02")).toEqual({
      status: "Pending",
      endDate: "2026-09-02",
    });
  });

  it("does not override Paid or existing Pending", () => {
    expect(applyEndDateChange("Paid", "2026-09-02")).toEqual({
      status: "Paid",
      endDate: "2026-09-02",
    });
    expect(applyEndDateChange("Pending", "2026-09-03")).toEqual({
      status: "Pending",
      endDate: "2026-09-03",
    });
  });

  it("does not reverse-fill when the completion date is cleared", () => {
    expect(applyEndDateChange("Pending", "")).toEqual({
      status: "Pending",
      endDate: "",
    });
  });
});

describe("applyStatusChange", () => {
  it("fills today's date when Pending or Paid and endDate is empty", () => {
    expect(applyStatusChange("Pending", "", "2026-09-02")).toEqual({
      status: "Pending",
      endDate: "2026-09-02",
    });
    expect(applyStatusChange("Paid", "", "2026-09-02")).toEqual({
      status: "Paid",
      endDate: "2026-09-02",
    });
  });

  it("keeps an existing endDate when switching to Paid", () => {
    expect(applyStatusChange("Paid", "2026-08-29", "2026-09-02")).toEqual({
      status: "Paid",
      endDate: "2026-08-29",
    });
  });

  it("does not fill endDate when switching back to In Progress", () => {
    expect(applyStatusChange("In Progress", "", "2026-09-02")).toEqual({
      status: "In Progress",
      endDate: "",
    });
  });
});
