CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'UAH',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Allow admins or authenticated users to manage expenses (adjust policy based on your project's auth setup)
CREATE POLICY "Enable all operations for authenticated users" ON public.expenses FOR ALL USING (auth.role() = 'authenticated');
