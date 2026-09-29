-- Add tax_model column with default 'spain_19' for backwards compatibility
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS tax_model TEXT DEFAULT 'spain_19';

-- Explicitly ensure all existing projects are tagged as spain_19
UPDATE public.projects
SET tax_model = 'spain_19'
WHERE tax_model IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_tax_model_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_tax_model_check
      CHECK (tax_model IN ('spain_19', 'fop_3'));
  END IF;
END
$$;
