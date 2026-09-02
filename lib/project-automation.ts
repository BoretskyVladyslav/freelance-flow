import type { PaymentStatus } from "@/types/finance";

export function applyEndDateChange(
  status: PaymentStatus,
  endDate: string,
): { status: PaymentStatus; endDate: string } {
  if (endDate && status === "In Progress") {
    return { status: "Pending", endDate };
  }
  return { status, endDate };
}

export function applyStatusChange(
  status: PaymentStatus,
  endDate: string,
  today: string,
): { status: PaymentStatus; endDate: string } {
  if ((status === "Pending" || status === "Paid") && !endDate) {
    return { status, endDate: today };
  }
  return { status, endDate };
}
