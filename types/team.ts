import type { UserRole } from "@/types/database";

export type ProfileStatus = "active" | "disabled";

export type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  status: ProfileStatus;
};

export type TeamScope = "all" | "personal";
