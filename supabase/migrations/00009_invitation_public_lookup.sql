-- ============================================================================
-- SPRINT 2: UNPROTECTED TOKEN VERIFICATION FOR INVITATION ACCEPTANCE
-- ============================================================================
-- When an invited user opens their invitation link (/accept-invitation?token=...),
-- they are not yet authenticated (auth.uid() is NULL).
-- This policy allows unauthenticated public lookup ONLY by exact matching valid,
-- unexpired, unaccepted token_hash.
-- ================a============================================================

-- Drop existing restrictive select policy
DROP POLICY IF EXISTS organization_invitations_select ON organization_invitations;

-- Create updated policy: members/admins can view their org invitations,
-- AND anyone can view a specific invitation if they possess the valid token_hash
CREATE POLICY organization_invitations_select ON organization_invitations
  FOR SELECT USING (
    -- Authenticated members/admins
    (auth.uid() IS NOT NULL AND (
      organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin()
    ))
    OR
    -- Public token-holder lookup (valid, unexpired, unaccepted tokens)
    (
      token_hash IS NOT NULL
      AND accepted_at IS NULL
      AND expires_at > NOW()
    )
  );

-- Allow public read of roles table for unauthenticated invitation page (basic role name display)
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
    OR auth.uid() IS NULL -- Allow unauthenticated token acceptance screen to resolve role name
  );

-- Allow public read of organizations name for invitation page
DROP POLICY IF EXISTS org_select_policy ON organizations;
CREATE POLICY org_select_policy ON organizations
  FOR SELECT USING (
    id IN (SELECT get_user_org_ids())
    OR is_platform_admin()
    OR auth.uid() IS NULL -- Allow unauthenticated token acceptance screen to resolve organization name
  );
