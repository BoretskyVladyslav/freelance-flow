-- Freelance Flow: Strict Role & RLS Separation Migration
-- Run this in the Supabase SQL Editor.

-- 1. Ensure projects table enforces strict RLS:
--    - Admin can SELECT, INSERT, UPDATE, DELETE all rows
--    - Employee can only SELECT, INSERT, UPDATE their own rows (employee_id = auth.uid())
--    - Employee CANNOT DELETE rows
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own_or_admin" ON public.projects;
CREATE POLICY "projects_select_own_or_admin"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "projects_insert_own_or_admin" ON public.projects;
CREATE POLICY "projects_insert_own_or_admin"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "projects_update_own_or_admin" ON public.projects;
CREATE POLICY "projects_update_own_or_admin"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin())
  WITH CHECK (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "projects_delete_own_or_admin" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_admin_only" ON public.projects;
CREATE POLICY "projects_delete_admin_only"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 2. Ensure expenses table has employee_id and enforces strict RLS:
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_employee_id_idx ON public.expenses (employee_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.expenses;

DROP POLICY IF EXISTS "expenses_select_own_or_admin" ON public.expenses;
CREATE POLICY "expenses_select_own_or_admin"
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "expenses_insert_own_or_admin" ON public.expenses;
CREATE POLICY "expenses_insert_own_or_admin"
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "expenses_update_own_or_admin" ON public.expenses;
CREATE POLICY "expenses_update_own_or_admin"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin())
  WITH CHECK (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "expenses_delete_admin_only" ON public.expenses;
CREATE POLICY "expenses_delete_admin_only"
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 3. If a separate transactions table exists in your instance, enforce identical policies:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    EXECUTE 'ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "transactions_select_own_or_admin" ON public.transactions';
    EXECUTE 'CREATE POLICY "transactions_select_own_or_admin" ON public.transactions FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "transactions_insert_own_or_admin" ON public.transactions';
    EXECUTE 'CREATE POLICY "transactions_insert_own_or_admin" ON public.transactions FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid() OR public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "transactions_update_own_or_admin" ON public.transactions';
    EXECUTE 'CREATE POLICY "transactions_update_own_or_admin" ON public.transactions FOR UPDATE TO authenticated USING (employee_id = auth.uid() OR public.is_admin()) WITH CHECK (employee_id = auth.uid() OR public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "transactions_delete_admin_only" ON public.transactions';
    EXECUTE 'CREATE POLICY "transactions_delete_admin_only" ON public.transactions FOR DELETE TO authenticated USING (public.is_admin())';
  END IF;
END $$;
