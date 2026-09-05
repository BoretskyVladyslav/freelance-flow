import { describe, expect, it } from "vitest";
import { scopeTeamExpenses, scopeTeamTransactions } from "@/lib/team-scope";
import type { Expense, Transaction } from "@/types/finance";

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

function exp(id: string, employeeId?: string): Expense {
  return {
    id,
    title: id,
    amount: 50,
    currency: "EUR",
    expense_date: "2026-09-01",
    employee_id: employeeId,
  };
}

const admin = tx("a", "admin-1");
const empA = tx("b", "emp-a");
const empB = tx("c", "emp-b");
const rows = [admin, empA, empB];

const expAdmin = exp("e1", "admin-1");
const expA = exp("e2", "emp-a");
const expB = exp("e3", "emp-b");
const expenseRows = [expAdmin, expA, expB];

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

  it("returns empty array for employees when currentUserId is not set", () => {
    expect(
      scopeTeamTransactions(rows, {
        isAdmin: false,
        currentUserId: "",
        teamScope: "all",
      }),
    ).toEqual([]);
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

describe("scopeTeamExpenses", () => {
  it("returns only current user's expenses for employees", () => {
    expect(
      scopeTeamExpenses(expenseRows, {
        isAdmin: false,
        currentUserId: "emp-a",
        teamScope: "all",
      }).map((row) => row.id),
    ).toEqual(["e2"]);
  });

  it("returns empty array for employees when currentUserId is empty", () => {
    expect(
      scopeTeamExpenses(expenseRows, {
        isAdmin: false,
        currentUserId: "",
        teamScope: "all",
      }),
    ).toEqual([]);
  });

  it("returns all expenses for admin on 'all'", () => {
    expect(
      scopeTeamExpenses(expenseRows, {
        isAdmin: true,
        currentUserId: "admin-1",
        teamScope: "all",
      }),
    ).toHaveLength(3);
  });

  it("filters admin view to specific employee expenses", () => {
    expect(
      scopeTeamExpenses(expenseRows, {
        isAdmin: true,
        currentUserId: "admin-1",
        teamScope: "emp-b",
      }).map((row) => row.id),
    ).toEqual(["e3"]);
  });
});
