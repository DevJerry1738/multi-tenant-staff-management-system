-- Restrict Manager attendance access to staff in the Manager's department.
-- Organization Admin and HR Manager retain organization-wide attendance access.

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
            user_has_org_role(target_org_id, 'Organization Admin')
            OR user_has_org_role(target_org_id, 'HR Manager')
            OR target_staff.organization_member_id = current_org_member_id(target_org_id)
            OR (
              user_has_org_role(target_org_id, 'Manager')
              AND viewer_staff.department_id IS NOT NULL
              AND target_staff.department_id = viewer_staff.department_id
            )
            OR (
              user_has_org_permission(target_org_id, 'attendance.manage')
              AND NOT user_has_org_role(target_org_id, 'Manager')
            )
          )
      )
    );
$$;

DROP POLICY IF EXISTS attendance_corrections_select_scoped ON public.attendance_correction_requests;

CREATE POLICY attendance_corrections_select_scoped ON public.attendance_correction_requests
  FOR SELECT USING (
    requested_by_member_id = current_org_member_id(organization_id)
    OR can_access_attendance(
      organization_id,
      (SELECT staff_id FROM public.attendance_records WHERE id = attendance_record_id)
    )
  );

COMMENT ON FUNCTION public.can_access_attendance(UUID, UUID) IS
  'Allows Admin/HR organization-wide access, Manager same-department access, and staff self-access.';
