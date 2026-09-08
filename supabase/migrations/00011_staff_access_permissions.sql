-- Extend the existing permission registry for Staff capability-aware access.
INSERT INTO public.permissions (key, name, module, description) VALUES
  ('staff.manage_access', 'Manage Portal Access', 'staff', 'Invite, disable, and manage staff portal access'),
  ('staff.view_sensitive', 'View Sensitive Staff Data', 'staff', 'View restricted employment and HR information'),
  ('staff.view_documents', 'View Staff Documents', 'staff', 'View staff documents within permitted scope'),
  ('staff.view_directory', 'View Staff Directory', 'staff', 'View limited directory information'),
  ('staff.update_self', 'Update Own Profile', 'staff', 'Update permitted fields on the current user profile')
ON CONFLICT (key) DO NOTHING;

-- Add capability defaults to existing system roles without duplicating links.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = ANY (
  CASE r.name
    WHEN 'Organization Admin' THEN ARRAY[
      'staff.manage_access', 'staff.view_sensitive', 'staff.view_documents',
      'staff.view_directory', 'staff.update_self'
    ]
    WHEN 'HR Manager' THEN ARRAY[
      'staff.manage_access', 'staff.view_sensitive', 'staff.view_documents',
      'staff.view_directory', 'staff.update_self'
    ]
    WHEN 'Manager' THEN ARRAY['staff.view_directory', 'staff.update_self']
    WHEN 'Staff' THEN ARRAY['staff.view_directory', 'staff.update_self']
    ELSE ARRAY[]::text[]
  END
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
