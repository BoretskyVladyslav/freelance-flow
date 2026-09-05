-- Remove the expenses table entirely
DROP TABLE IF EXISTS public.expenses;

-- Remove the withdrawn column from projects
ALTER TABLE public.projects DROP COLUMN IF EXISTS withdrawn;
