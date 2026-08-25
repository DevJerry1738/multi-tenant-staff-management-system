-- ============================================================================
-- STABLE AUTHENTICATED SESSION MEMBERSHIP LOOKUP
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_organization_memberships()
RETURNS TABLE (
    membership_id UUID,
    organization_id UUID,
    user_id UUID,
    membership_status member_status,
    organization_name TEXT,
    organization_slug TEXT,
    organization_status org_status,
    organization_country TEXT,
    organization_timezone TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        om.id,
        om.organization_id,
        om.user_id,
        om.status,
        o.name,
        o.slug,
        o.status,
        o.country,
        o.timezone
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION get_my_organization_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_organization_memberships() TO authenticated;
