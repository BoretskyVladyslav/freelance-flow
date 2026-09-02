import { describe, expect, it } from "vitest";
import { scopeTeamTransactions } from "@/lib/team-scope";
import type { Transaction } from "@/types/finance";

function tx(id: string, employeeId?: string): Transaction {
  return {
    id,
    title: id,
    platform: "Direct Client",
    grossAmount: 100,
    currency: "EUR",
    customFee: 0,
    exchangeRateAtCreation: 1,
    date: "2026-09-01",
    status: "Pending",
    weekNumber: 36,
    employeeId,
  };
}

const admin = tx("a", "admin-1");
const empA = tx("b", "emp-a");
const empB = tx("c", "emp-b");
const rows = [admin, empA, empB];

describe("scopeTeamTransactions", () => {
  it("returns only the current user's projects for employees", () => {
    expect(
      scopeTeamTransactions(rows, {
        isAdmin: false,
        currentUserId: "emp-a",
        teamScope: "all",
      }).map((row) => row.id),
    ).toEqual(["b"]);
  });

  it("returns every project for an admin on Усі працівники", () => {
    expect(
      scopeTeamTransactions(rows, {
        isAdmin: true,
        currentUserId: "admin-1",
        teamScope: "all",
      }),
    ).toHaveLength(3);
  });

  it("filters an admin view to a specific employee_id", () => {
    expect(
      scopeTeamTransactions(rows, {
        isAdmin: true,
        currentUserId: "admin-1",
        teamScope: "emp-b",
      }).map((row) => row.id),
    ).toEqual(["c"]);
  });
});
