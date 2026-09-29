ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS gross_uah NUMERIC(14, 2);

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS net_uah NUMERIC(14, 2);

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS uah_rate_at_creation NUMERIC(18, 8);
