-- Persist organization contact details collected by the setup wizard.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS website TEXT NULL;
