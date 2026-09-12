-- Production attendance foundation: schema compatibility, scope helpers, and RLS.
-- This extends the existing attendance tables; it does not replace RBAC.

-- -----------------------------------------------------------------------------
-- 1. Compatible attendance fields and rule settings
-- -----------------------------------------------------------------------------

ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'early_departure';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'weekend';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'not_recorded';

ALTER TYPE public.attendance_source ADD VALUE IF NOT EXISTS 'platform';
ALTER TYPE public.attendance_source ADD VALUE IF NOT EXISTS 'biometric';
ALTER TYPE public.attendance_source ADD VALUE IF NOT EXISTS 'correction';

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_daily_hours NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS working_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb;

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS work_location public.work_mode,
  ADD COLUMN IF NOT EXISTS original_clock_in TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_clock_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT,
  ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.attendance_import_batches(id) ON DELETE SET NULL;

UPDATE public.attendance_records
SET work_location = work_mode
WHERE work_location IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_org_date
  ON public.attendance_records(organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date
  ON public.attendance_records(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status
  ON public.attendance_records(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_created
  ON public.attendance_records(organization_id, created_at);

-- -----------------------------------------------------------------------------
-- 2. Correction requests preserve originals and separate request from approval
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  requested_by_member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE RESTRICT,
  reviewed_by_member_id UUID NULL REFERENCES public.organization_members(id) ON DELETE RESTRICT,
  original_clock_in TIMESTAMPTZ NULL,
  original_clock_out TIMESTAMPTZ NULL,
  requested_clock_in TIMESTAMPTZ NULL,
  requested_clock_out TIMESTAMPTZ NULL,
  requested_work_location public.work_mode NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_org_status
  ON public.attendance_correction_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_record
  ON public.attendance_correction_requests(attendance_record_id);

-- -----------------------------------------------------------------------------
-- 3. Privilege and scope helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_org_member_id(target_org_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.organization_members
  WHERE organization_id = target_org_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_permission(target_org_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.member_roles mr
      JOIN public.organization_members om
        ON om.id = mr.organization_member_id
       AND om.organization_id = target_org_id
       AND om.user_id = auth.uid()
       AND om.status = 'active'
      JOIN public.role_permissions rp ON rp.role_id = mr.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.key = permission_key
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_role(target_org_id UUID, role_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.member_roles mr
      JOIN public.organization_members om
        ON om.id = mr.organization_member_id
       AND om.organization_id = target_org_id
       AND om.user_id = auth.uid()
       AND om.status = 'active'
      JOIN public.roles r ON r.id = mr.role_id
      WHERE r.name = role_name
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_attendance(target_org_id UUID, target_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin()
    OR (
      user_has_org_permission(target_org_id, 'attendance.view')
      AND EXISTS (
        SELECT 1
        FROM public.staff_profiles target_staff
        LEFT JOIN public.staff_profiles viewer_staff
          ON viewer_staff.organization_member_id = current_org_member_id(target_org_id)
         AND viewer_staff.organization_id = target_org_id
        WHERE target_staff.id = target_staff_id
          AND target_staff.organization_id = target_org_id
          AND (
            user_has_org_permission(target_org_id, 'attendance.manage')
            OR target_staff.organization_member_id = current_org_member_id(target_org_id)
            OR (
              target_staff.manager_id = viewer_staff.id
              OR (viewer_staff.department_id IS NOT NULL AND target_staff.department_id = viewer_staff.department_id)
              OR (viewer_staff.team_id IS NOT NULL AND target_staff.team_id = viewer_staff.team_id)
            )
          )
      )
    );
$$;

-- -----------------------------------------------------------------------------
-- 4. Replace broad attendance policies with permission/scope-aware policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS attendance_select ON public.attendance_records;
DROP POLICY IF EXISTS attendance_all ON public.attendance_records;
DROP POLICY IF EXISTS attendance_batches_select ON public.attendance_import_batches;

CREATE POLICY attendance_select_scoped ON public.attendance_records
  FOR SELECT USING (
    can_access_attendance(organization_id, staff_id)
  );

CREATE POLICY attendance_insert_own ON public.attendance_records
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND staff_id IN (
      SELECT sp.id
      FROM public.staff_profiles sp
      WHERE sp.organization_member_id = current_org_member_id(public.attendance_records.organization_id)
        AND sp.organization_id = public.attendance_records.organization_id
    )
    AND user_has_org_permission(organization_id, 'attendance.view')
  );

CREATE POLICY attendance_update_authorized ON public.attendance_records
  FOR UPDATE USING (
    can_access_attendance(organization_id, staff_id)
    AND (
      user_has_org_permission(organization_id, 'attendance.manage')
      OR staff_id IN (
        SELECT sp.id
        FROM public.staff_profiles sp
        WHERE sp.organization_member_id = current_org_member_id(public.attendance_records.organization_id)
          AND sp.organization_id = public.attendance_records.organization_id
      )
    )
  ) WITH CHECK (
    can_access_attendance(organization_id, staff_id)
  );

CREATE POLICY attendance_batches_select_scoped ON public.attendance_import_batches
  FOR SELECT USING (
    user_has_org_permission(organization_id, 'attendance.import')
  );

ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_corrections_select_scoped ON public.attendance_correction_requests
  FOR SELECT USING (
    user_has_org_permission(organization_id, 'attendance.manage')
    OR requested_by_member_id = current_org_member_id(organization_id)
  );

CREATE POLICY attendance_corrections_insert_scoped ON public.attendance_correction_requests
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND requested_by_member_id = current_org_member_id(organization_id)
    AND (
      user_has_org_permission(organization_id, 'attendance.manage')
      OR can_access_attendance(organization_id, (SELECT staff_id FROM public.attendance_records WHERE id = attendance_record_id))
    )
  );

CREATE POLICY attendance_corrections_update_scoped ON public.attendance_correction_requests
  FOR UPDATE USING (
    user_has_org_permission(organization_id, 'attendance.manage')
  ) WITH CHECK (
    user_has_org_permission(organization_id, 'attendance.manage')
  );

-- Attendance records and correction requests are never deleted by application users.
REVOKE DELETE ON public.attendance_records FROM authenticated;
REVOKE DELETE ON public.attendance_correction_requests FROM authenticated;

-- Only organization admins may change attendance configuration.
DROP POLICY IF EXISTS org_settings_all ON public.organization_settings;
CREATE POLICY org_settings_update_attendance_admin ON public.organization_settings
  FOR UPDATE USING (
    user_has_org_role(organization_id, 'Organization Admin')
  ) WITH CHECK (
    user_has_org_role(organization_id, 'Organization Admin')
  );

COMMENT ON TABLE public.attendance_correction_requests IS
  'Correction workflow preserving original attendance values until an authorized reviewer approves a change.';
COMMENT ON FUNCTION public.can_access_attendance(UUID, UUID) IS
  'Tenant- and permission-aware attendance visibility for self, team/department, and organization scopes.';
