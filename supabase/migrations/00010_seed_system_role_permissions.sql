-- Ensure every system role has the permissions defined by its role name.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = ANY (
  CASE r.name
    WHEN 'Organization Admin' THEN ARRAY[
      'staff.view', 'staff.create', 'staff.update', 'staff.archive',
      'attendance.view', 'attendance.manage', 'attendance.import',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'documents.upload', 'documents.delete',
      'announcements.view', 'announcements.create', 'announcements.manage',
      'reports.view', 'reports.export', 'audit_logs.view',
      'organization.view', 'organization.update',
      'departments.view', 'departments.create', 'departments.update', 'departments.archive',
      'teams.view', 'teams.create', 'teams.update', 'teams.archive',
      'roles.view', 'roles.create', 'roles.update', 'roles.delete',
      'settings.view', 'settings.update'
    ]
    WHEN 'HR Manager' THEN ARRAY[
      'staff.view', 'staff.create', 'staff.update', 'staff.archive',
      'attendance.view', 'attendance.manage', 'attendance.import',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'documents.upload', 'documents.delete',
      'announcements.view', 'announcements.create', 'reports.view', 'reports.export'
    ]
    WHEN 'Manager' THEN ARRAY[
      'staff.view', 'attendance.view', 'attendance.manage',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'announcements.view', 'reports.view'
    ]
    WHEN 'Staff' THEN ARRAY[
      'staff.view', 'attendance.view', 'leave.view', 'leave.request',
      'documents.view', 'announcements.view'
    ]
    ELSE ARRAY[]::text[]
  END
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
