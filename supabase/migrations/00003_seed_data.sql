-- ==============================================================================
-- SPRINT 0: SEED DATA FOR DEVELOPMENT & TENANT ISOLATION TESTING
-- (All UUIDs strictly compliant with RFC 4122 / PostgreSQL UUID parser)
-- ==============================================================================

-- 1. SEED SYSTEM PERMISSIONS
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

('audit_logs.view', 'View Audit Logs', 'audit', 'View audit logs')
ON CONFLICT (key) DO NOTHING;

-- 2. SEED DEMO ORGANIZATIONS
INSERT INTO organizations (id, name, slug, industry, country, timezone, status) VALUES
('11111111-1111-1111-1111-111111111111', 'Demo Realty A', 'demo-realty-a', 'Real Estate', 'United States', 'America/New_York', 'active'),
('22222222-2222-2222-2222-222222222222', 'Demo Realty B', 'demo-realty-b', 'Real Estate Development', 'Canada', 'America/Toronto', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. SEED SETTINGS
INSERT INTO organization_settings (organization_id, default_work_start, default_work_end, attendance_enabled, leave_enabled) VALUES
('11111111-1111-1111-1111-111111111111', '09:00:00', '17:00:00', true, true),
('22222222-2222-2222-2222-222222222222', '08:30:00', '16:30:00', true, true)
ON CONFLICT (organization_id) DO NOTHING;

-- 4. SEED ROLES FOR DEMO REALTY A
INSERT INTO roles (id, organization_id, name, description, is_system_role) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Organization Admin', 'Full access to Organization A', true),
('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'HR Manager', 'Manages staff, leave and documents', true),
('a3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Manager', 'Team management', true),
('a4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Staff', 'Self service access', true)
ON CONFLICT (id) DO NOTHING;

-- SEED ROLES FOR DEMO REALTY B
INSERT INTO roles (id, organization_id, name, description, is_system_role) VALUES
('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Organization Admin', 'Full access to Organization B', true),
('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'HR Manager', 'HR lead for Organization B', true),
('b3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Staff', 'Standard staff user', true)
ON CONFLICT (id) DO NOTHING;

-- 5. LINK ALL PERMISSIONS TO ORG ADMIN ROLES
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a1111111-1111-1111-1111-111111111111', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'b1111111-1111-1111-1111-111111111111', id FROM permissions
ON CONFLICT DO NOTHING;

-- 6. SEED DEPARTMENTS & TEAMS FOR ORG A (Pure hex 0-9, a-f)
INSERT INTO departments (id, organization_id, name, description) VALUES
('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Sales & Brokerage', 'Residential and commercial listings team'),
('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'Human Resources', 'People ops and staff management')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, organization_id, department_id, name, description) VALUES
('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'Luxury Residential', 'High value properties unit')
ON CONFLICT (id) DO NOTHING;

-- SEED DEPARTMENTS FOR ORG B
INSERT INTO departments (id, organization_id, name, description) VALUES
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Asset Development', 'Commercial development project team')
ON CONFLICT (id) DO NOTHING;

-- 7. SEED SAMPLE STAFF FOR ORG A
INSERT INTO staff_profiles (
    id, organization_id, employee_number, first_name, last_name, email, phone, job_title, department_id, team_id, employment_type, employment_status, date_joined
) VALUES
('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'EMP-A001', 'Alice', 'Vance', 'alice@demorealtyA.com', '+1-555-0101', 'Principal Broker', '33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444441', 'full_time', 'active', '2023-01-15'),
('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 'EMP-A002', 'Aaron', 'Smith', 'aaron@demorealtyA.com', '+1-555-0102', 'HR Specialist', '33333333-3333-3333-3333-333333333332', NULL, 'full_time', 'active', '2023-04-01')
ON CONFLICT (id) DO NOTHING;

-- SEED SAMPLE STAFF FOR ORG B
INSERT INTO staff_profiles (
    id, organization_id, employee_number, first_name, last_name, email, phone, job_title, department_id, employment_type, employment_status, date_joined
) VALUES
('55555555-5555-5555-5555-555555555553', '22222222-2222-2222-2222-222222222222', 'EMP-B001', 'Bob', 'Builder', 'bob@demorealtyB.com', '+1-555-0201', 'Development Lead', '33333333-3333-3333-3333-333333333333', 'full_time', 'active', '2022-08-10')
ON CONFLICT (id) DO NOTHING;
