import type { PaymentStatus, Platform } from "@/types/finance";

export const PLATFORM_LABELS: Record<Platform, string> = {
  Freelancehunt: "Freelancehunt",
  "Freelance BG": "Freelance BG",
  "Direct Client": "Прямий клієнт",
  Other: "Інше",
};

export const STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: "Очікується",
  Paid: "Виплачено",
  "In Progress": "В процесі",
};
