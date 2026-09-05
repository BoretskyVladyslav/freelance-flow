import type { Transaction } from "@/types/finance";
import type { TeamScope } from "@/types/team";

export function scopeTeamTransactions(
  transactions: Transaction[],
  options: { isAdmin: boolean; currentUserId: string; teamScope: TeamScope },
): Transaction[] {
  const { isAdmin, currentUserId, teamScope } = options;
  if (!isAdmin) {
    if (!currentUserId) return [];
    return transactions.filter((row) => row.employeeId === currentUserId);
  }
  if (teamScope === "all") return transactions;
  const employeeId = teamScope === "personal" ? currentUserId : teamScope;
  if (!employeeId) return transactions;
  return transactions.filter((row) => row.employeeId === employeeId);
}
