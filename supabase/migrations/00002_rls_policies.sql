-- ==============================================================================
-- SPRINT 0: ROW LEVEL SECURITY (RLS) POLICIES & FUNCTIONS
-- ==============================================================================

-- 1. HELPER FUNCTIONS

-- Helper: Get array of active organization IDs for current authenticated user
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT organization_id
    FROM organization_members
    WHERE user_id = auth.uid()
      AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Check if authenticated user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM platform_admins
        WHERE user_id = auth.uid()
          AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ==============================================================================
-- 2. ENABLE RLS ON ALL ORGANIZATION-OWNED TABLES
-- ==============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 3. RLS POLICIES FOR CORE & RBAC TABLES
-- ==============================================================================

-- ORGANIZATIONS: Users can view organizations where they are active members, or if they are platform admin
CREATE POLICY org_select_policy ON organizations
    FOR SELECT USING (
        id IN (SELECT get_user_org_ids()) OR is_platform_admin()
    );

CREATE POLICY org_admin_policy ON organizations
    FOR ALL USING (is_platform_admin());

-- ORGANIZATION SETTINGS
CREATE POLICY org_settings_select ON organization_settings
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

CREATE POLICY org_settings_all ON organization_settings
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- ORGANIZATION MEMBERS
CREATE POLICY org_members_select ON organization_members
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR user_id = auth.uid() OR is_platform_admin());

CREATE POLICY org_members_all ON organization_members
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- PLATFORM ADMINS: Only platform admins or user checking self
CREATE POLICY platform_admins_select ON platform_admins
    FOR SELECT USING (user_id = auth.uid() OR is_platform_admin());

-- ROLES
CREATE POLICY roles_select ON roles
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

CREATE POLICY roles_all ON roles
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- PERMISSIONS: Global definitions readable by any authenticated user
CREATE POLICY permissions_select ON permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- ROLE PERMISSIONS
CREATE POLICY role_permissions_select ON role_permissions
    FOR SELECT USING (
        role_id IN (SELECT id FROM roles WHERE organization_id IN (SELECT get_user_org_ids()))
        OR is_platform_admin()
    );

-- MEMBER ROLES
CREATE POLICY member_roles_select ON member_roles
    FOR SELECT USING (
        organization_member_id IN (SELECT id FROM organization_members WHERE organization_id IN (SELECT get_user_org_ids()))
        OR is_platform_admin()
    );


-- ==============================================================================
-- 4. RLS POLICIES FOR STAFF & OPERATIONAL TABLES
-- ==============================================================================

-- DEPARTMENTS
CREATE POLICY departments_select ON departments
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY departments_all ON departments
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- TEAMS
CREATE POLICY teams_select ON teams
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY teams_all ON teams
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- STAFF PROFILES
CREATE POLICY staff_select ON staff_profiles
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY staff_all ON staff_profiles
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- ATTENDANCE RECORDS
CREATE POLICY attendance_select ON attendance_records
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY attendance_all ON attendance_records
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- ATTENDANCE IMPORT BATCHES
CREATE POLICY attendance_batches_select ON attendance_import_batches
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- LEAVE TYPES
CREATE POLICY leave_types_select ON leave_types
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- LEAVE BALANCES
CREATE POLICY leave_balances_select ON leave_balances
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- LEAVE REQUESTS
CREATE POLICY leave_requests_select ON leave_requests
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY leave_requests_all ON leave_requests
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- LEAVE APPROVALS
CREATE POLICY leave_approvals_select ON leave_approvals
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- ANNOUNCEMENTS
CREATE POLICY announcements_select ON announcements
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- ANNOUNCEMENT TARGETS
CREATE POLICY announcement_targets_select ON announcement_targets
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- NOTIFICATIONS
CREATE POLICY notifications_select ON notifications
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- NOTIFICATION PREFERENCES
CREATE POLICY notif_pref_select ON notification_preferences
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- NOTIFICATION DELIVERIES
CREATE POLICY notif_deliv_select ON notification_deliveries
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- DOCUMENT CATEGORIES
CREATE POLICY doc_cat_select ON document_categories
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- STAFF DOCUMENTS
CREATE POLICY staff_docs_select ON staff_documents
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());
CREATE POLICY staff_docs_all ON staff_documents
    FOR ALL USING (organization_id IN (SELECT get_user_org_ids()) OR is_platform_admin());

-- AUDIT LOGS: Org-level visible to members of that org; NULL org_id visible only to platform admin
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT USING (
        (organization_id IS NOT NULL AND organization_id IN (SELECT get_user_org_ids()))
        OR is_platform_admin()
    );


-- ==============================================================================
-- 5. PRIVATE SUPABASE STORAGE BUCKET RLS POLICIES
-- Bucket: staff-documents
-- Structure: staff-documents/{organization_id}/{staff_id}/{document_id}/{filename}
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('staff-documents', 'staff-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow members access to their org documents in storage"
ON storage.objects FOR ALL USING (
    bucket_id = 'staff-documents' AND (
        (storage.foldername(name))[1]::uuid IN (SELECT get_user_org_ids())
        OR is_platform_admin()
    )
);
