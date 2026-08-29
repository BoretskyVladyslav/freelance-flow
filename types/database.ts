export type UserRole = "admin" | "employee";
export type ProfileStatus = "active" | "disabled";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          full_name: string;
          status: ProfileStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          full_name?: string;
          status?: ProfileStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          full_name?: string;
          status?: ProfileStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          employee_id: string;
          created_by: string | null;
          title: string;
          client_id: string | null;
          client_name: string | null;
          platform: string;
          gross_amount: number;
          currency: string;
          custom_fee: number;
          exchange_rate_at_creation: number;
          date: string;
          start_date: string | null;
          end_date: string | null;
          payout_date: string | null;
          status: string;
          week_number: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          created_by?: string | null;
          title: string;
          client_id?: string | null;
          client_name?: string | null;
          platform: string;
          gross_amount: number;
          currency: string;
          custom_fee?: number;
          exchange_rate_at_creation: number;
          date: string;
          start_date?: string | null;
          end_date?: string | null;
          payout_date?: string | null;
          status: string;
          week_number: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          created_by?: string | null;
          title?: string;
          client_id?: string | null;
          client_name?: string | null;
          platform?: string;
          gross_amount?: number;
          currency?: string;
          custom_fee?: number;
          exchange_rate_at_creation?: number;
          date?: string;
          start_date?: string | null;
          end_date?: string | null;
          payout_date?: string | null;
          status?: string;
          week_number?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
