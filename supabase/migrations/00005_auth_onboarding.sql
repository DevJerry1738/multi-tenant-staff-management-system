-- ============================================================================
-- AUTHENTICATION, ORGANIZATION ONBOARDING, AND ACCOUNT ACCESS
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ NULL;

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS attendance_method TEXT NOT NULL DEFAULT 'platform_clocking',
  ADD COLUMN IF NOT EXISTS allow_remote BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_field BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_clock_out BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_access_status') THEN
    CREATE TYPE account_access_status AS ENUM ('no_account', 'invited', 'active', 'suspended', 'deactivated');
  END IF;
END $$;

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS account_access_status account_access_status NOT NULL DEFAULT 'no_account';

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC(6, 2) NULL;

CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_profile_id UUID NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invitation_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org
  ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email
  ON organization_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_org_invitations_staff
  ON organization_invitations(staff_profile_id);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_invitations_select ON organization_invitations
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

CREATE POLICY organization_invitations_manage ON organization_invitations
  FOR ALL USING (
    organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
  );

COMMENT ON TABLE organization_invitations IS
  'Invitation metadata; token_hash is only consumed by trusted server-side provisioning functions.';
COMMENT ON COLUMN organization_invitations.token_hash IS
  'SHA-256 hash of the one-time invitation token. Never return this column to the browser.';
