import type { UserRole } from "@/types/database";
import type { ProfileStatus } from "@/types/team";
import type { PaymentStatus, Platform, TaxModel } from "@/types/finance";

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

export const STATUS_DESCRIPTIONS: Record<PaymentStatus, string> = {
  "In Progress": "Проєкт активно розробляється.",
  Pending: "Проєкт завершено, виплата очікується.",
  Paid: "Виплату отримано.",
};

export const PLATFORM_FILTER_ITEMS = {
  all: "Всі платформи",
  ...PLATFORM_LABELS,
} as const;

export const STATUS_FILTER_ITEMS = {
  all: "Всі статуси",
  ...STATUS_LABELS,
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Адмін",
  employee: "Працівник",
};

export const TAX_MODEL_LABELS: Record<TaxModel, string> = {
  spain_19: "Іспанія (19%)",
  fop_3: "ФОП 3 гр. (5% + 1%)",
};

export const STATUS_ACCOUNT_LABELS: Record<ProfileStatus, string> = {
  active: "Активний",
  disabled: "Вимкнено",
};

export const TEAM_SCOPE_ITEMS = {
  all: "Усі працівники",
  personal: "Персонально",
} as const;
