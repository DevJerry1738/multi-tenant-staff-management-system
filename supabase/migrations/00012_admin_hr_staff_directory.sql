-- Restrict Staff directory access to Organization Admin and HR Manager.
-- Existing migrations remain unchanged; this migration repairs role links.

INSERT INTO public.permissions (key, name, module, description) VALUES
  ('staff.view_directory', 'View Staff Directory', 'staff', 'View the organization staff directory')
ON CONFLICT (key) DO NOTHING;

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.key = 'staff.view_directory'
  AND r.name IN ('Manager', 'Staff');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p
  ON p.key = 'staff.view_directory'
WHERE r.name IN ('Organization Admin', 'HR Manager')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = ANY (ARRAY[
  'departments.view', 'departments.create', 'departments.update', 'departments.archive',
  'teams.view', 'teams.create', 'teams.update', 'teams.archive'
])
WHERE r.name = 'HR Manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;
