-- Permission-aware department/team management.
-- Deletion is represented by is_active = false to preserve history and assignments.

CREATE INDEX IF NOT EXISTS idx_departments_org_active
  ON public.departments(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_teams_org_active
  ON public.teams(organization_id, is_active);

DROP POLICY IF EXISTS departments_all ON public.departments;
DROP POLICY IF EXISTS teams_all ON public.teams;

CREATE POLICY departments_insert_authorized ON public.departments
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'departments.create')
    AND (manager_id IS NULL OR EXISTS (
      SELECT 1 FROM public.staff_profiles s
      WHERE s.id = manager_id AND s.organization_id = organization_id
    ))
  );

CREATE POLICY departments_update_authorized ON public.departments
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'departments.update')
  ) WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'departments.update')
    AND (manager_id IS NULL OR EXISTS (
      SELECT 1 FROM public.staff_profiles s
      WHERE s.id = manager_id AND s.organization_id = organization_id
    ))
  );

CREATE POLICY departments_archive_authorized ON public.departments
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'departments.archive')
  ) WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'departments.archive')
  );

CREATE POLICY teams_insert_authorized ON public.teams
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'teams.create')
    AND (manager_id IS NULL OR EXISTS (
      SELECT 1 FROM public.staff_profiles s
      WHERE s.id = manager_id AND s.organization_id = organization_id
    ))
    AND (department_id IS NULL OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.organization_id = organization_id
    ))
  );

CREATE POLICY teams_update_authorized ON public.teams
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'teams.update')
  ) WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'teams.update')
    AND (manager_id IS NULL OR EXISTS (
      SELECT 1 FROM public.staff_profiles s
      WHERE s.id = manager_id AND s.organization_id = organization_id
    ))
    AND (department_id IS NULL OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.organization_id = organization_id
    ))
  );

CREATE POLICY teams_archive_authorized ON public.teams
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'teams.archive')
  ) WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
    AND user_has_org_permission(organization_id, 'teams.archive')
  );

REVOKE DELETE ON public.departments FROM authenticated;
REVOKE DELETE ON public.teams FROM authenticated;

COMMENT ON COLUMN public.departments.is_active IS 'False means archived; rows are retained for historical references.';
COMMENT ON COLUMN public.teams.is_active IS 'False means archived; rows are retained for historical references.';
