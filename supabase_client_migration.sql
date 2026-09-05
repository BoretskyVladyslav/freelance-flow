-- Add 'client_name' to track which customer ordered the project
ALTER TABLE public.projects ADD COLUMN client_name TEXT;
