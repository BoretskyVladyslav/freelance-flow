-- Add 'withdrawn' flag to track which paid projects have been cashed out to a personal card
ALTER TABLE public.projects ADD COLUMN withdrawn BOOLEAN DEFAULT false;
