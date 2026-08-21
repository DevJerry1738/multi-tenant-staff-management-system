-- ==============================================================================
-- CLEAN RESET SCRIPT: Wipes sample tenants and resets database to fresh state
-- ==============================================================================

-- Delete in cascade order to prevent FK violations
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE staff_documents CASCADE;
TRUNCATE TABLE document_categories CASCADE;
TRUNCATE TABLE notification_deliveries CASCADE;
TRUNCATE TABLE notification_preferences CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE announcement_targets CASCADE;
TRUNCATE TABLE announcements CASCADE;
TRUNCATE TABLE leave_approvals CASCADE;
TRUNCATE TABLE leave_requests CASCADE;
TRUNCATE TABLE leave_balances CASCADE;
TRUNCATE TABLE leave_types CASCADE;
TRUNCATE TABLE attendance_import_batches CASCADE;
TRUNCATE TABLE attendance_records CASCADE;
TRUNCATE TABLE staff_profiles CASCADE;
TRUNCATE TABLE teams CASCADE;
TRUNCATE TABLE departments CASCADE;
TRUNCATE TABLE member_roles CASCADE;
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE roles CASCADE;
TRUNCATE TABLE organization_members CASCADE;
TRUNCATE TABLE organization_settings CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- Ensure system permissions remain intact
INSERT INTO permissions (key, name, module, description) VALUES
('staff.view', 'View Staff', 'staff', 'View staff profiles within organization'),
('staff.create', 'Create Staff', 'staff', 'Add new staff members'),
('staff.update', 'Update Staff', 'staff', 'Edit staff profile details'),
('staff.archive', 'Archive Staff', 'staff', 'Archive staff records'),
('attendance.view', 'View Attendance', 'attendance', 'View attendance logs'),
('attendance.manage', 'Manage Attendance', 'attendance', 'Manually update clock-in/out logs'),
('attendance.import', 'Import Attendance', 'attendance', 'Upload attendance batch files'),
('leave.view', 'View Leave', 'leave', 'View leave requests and balances'),
('leave.request', 'Submit Leave Request', 'leave', 'Submit personal leave request'),
('leave.approve', 'Approve Leave', 'leave', 'Approve or reject team leave requests'),
('documents.view', 'View Documents', 'documents', 'View staff documents'),
('documents.upload', 'Upload Documents', 'documents', 'Upload confidential staff documents'),
('documents.delete', 'Delete Documents', 'documents', 'Delete staff documents'),
('announcements.view', 'View Announcements', 'announcements', 'View organization announcements'),
('announcements.create', 'Create Announcement', 'announcements', 'Post new announcements'),
('announcements.manage', 'Manage Announcements', 'announcements', 'Edit/delete organization announcements'),
('reports.view', 'View Reports', 'reports', 'View analytics and export reports'),
('reports.export', 'Export Reports', 'reports', 'Export data files'),
('audit_logs.view', 'View Audit Logs', 'audit', 'View audit logs'),
('organization.view', 'View Org Settings', 'organization', 'View organization settings'),
('organization.update', 'Update Org Settings', 'organization', 'Update organization settings'),
('departments.view', 'View Departments', 'departments', 'View departments'),
('departments.create', 'Create Departments', 'departments', 'Create departments'),
('departments.update', 'Edit Departments', 'departments', 'Edit departments'),
('departments.archive', 'Archive Departments', 'departments', 'Archive departments'),
('teams.view', 'View Teams', 'teams', 'View teams'),
('teams.create', 'Create Teams', 'teams', 'Create teams'),
('teams.update', 'Edit Teams', 'teams', 'Edit teams'),
('teams.archive', 'Archive Teams', 'teams', 'Archive teams'),
('roles.view', 'View Roles', 'roles', 'View roles'),
('roles.create', 'Create Roles', 'roles', 'Create roles'),
('roles.update', 'Edit Roles', 'roles', 'Edit roles'),
('roles.delete', 'Delete Roles', 'roles', 'Delete roles'),
('settings.view', 'View Settings', 'settings', 'View organization settings'),
('settings.update', 'Update Settings', 'settings', 'Update organization settings')
ON CONFLICT (key) DO NOTHING;
