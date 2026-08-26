-- ============================================================================
-- SPRINT 2: AUDIT LOG INSERT POLICY (SECURE, SERVER-DERIVED ACTOR IDENTITY)
-- ============================================================================
-- Root cause: No INSERT policy existed on audit_logs. Only a SELECT policy
-- was defined in 00002_rls_policies.sql. With RLS enabled and no INSERT
-- policy present, PostgreSQL blocks all inserts by default.
--
-- This policy enforces:
--   1. actor_user_id must equal auth.uid()  (prevents impersonation)
--   2. actor_member_id, if supplied, must belong to auth.uid()
--   3. organization_id must be an org where auth.uid() is an active member
--      OR NULL (platform-level event) only for platform admins
-- ============================================================================

-- -- Helper function ---------------------------------------------------------
-- Returns true when the given organization_member row belongs to auth.uid().
-- SECURITY DEFINER so it can read organization_members without being blocked
-- by the org_members_select RLS policy during the INSERT check evaluation.
CREATE OR REPLACE FUNCTION member_belongs_to_caller(p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE id = p_member_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION member_belongs_to_caller(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION member_belongs_to_caller(UUID) TO authenticated;

-- -- INSERT policy ------------------------------------------------------------
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (
        -- A: actor_user_id must be the authenticated caller — no impersonation
        actor_user_id = auth.uid()

        -- B: actor_member_id, if provided, must belong to auth.uid()
        AND (
            actor_member_id IS NULL
            OR member_belongs_to_caller(actor_member_id)
        )

        -- C: organisation scope
        AND (
            -- org-level event: caller must be an active member of that org
            (
                organization_id IS NOT NULL
                AND organization_id IN (SELECT get_user_org_ids())
            )
            OR
            -- platform-level event (org_id NULL): platform admins only
            (
                organization_id IS NULL
                AND is_platform_admin()
            )
        )
    );
