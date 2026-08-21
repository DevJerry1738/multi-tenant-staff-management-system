-- ==============================================================================
-- SPRINT 0: MULTI-TENANT STAFF MANAGEMENT PLATFORM FOUNDATION SCHEMA MIGRATION
-- ==============================================================================

-- 1. EXTENSIONS & UTILITIES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES

-- Organization status
CREATE TYPE org_status AS ENUM ('active', 'suspended');

-- Organization member status
CREATE TYPE member_status AS ENUM ('active', 'invited', 'suspended');

-- Platform admin status
CREATE TYPE platform_admin_status AS ENUM ('active', 'suspended');

-- Employment types
CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern', 'temporary');

-- Employment status
CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'probation', 'terminated', 'suspended');

-- Attendance status
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'on_leave', 'holiday');

-- Work modes
CREATE TYPE work_mode AS ENUM ('office', 'remote', 'field');

-- Attendance sources
CREATE TYPE attendance_source AS ENUM ('manual', 'self', 'import', 'admin');

-- Attendance import batch status
CREATE TYPE batch_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Leave request status
CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Announcement priority
CREATE TYPE announcement_priority AS ENUM ('normal', 'important', 'urgent');

-- Announcement status
CREATE TYPE announcement_status AS ENUM ('draft', 'scheduled', 'published', 'archived');

-- Target types for announcements
CREATE TYPE target_type AS ENUM ('all', 'department', 'team', 'role', 'individual');

-- Notification channels
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'whatsapp');


-- ==============================================================================
-- 3. CORE TENANCY & PLATFORM TABLES
-- ==============================================================================

-- Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT NULL,
    industry TEXT NULL,
    country TEXT NULL,
    timezone TEXT NULL DEFAULT 'UTC',
    status org_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Settings (1:1 with Organization)
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    default_work_start TIME NULL DEFAULT '09:00:00',
    default_work_end TIME NULL DEFAULT '17:00:00',
    attendance_enabled BOOLEAN NOT NULL DEFAULT true,
    leave_enabled BOOLEAN NOT NULL DEFAULT true,
    notification_settings JSONB NULL DEFAULT '{"email": true, "in_app": true, "whatsapp": false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Members (auth.users <-> organizations link)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status member_status NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_member_user UNIQUE (organization_id, user_id)
);

-- Platform Admins (Separate from org-level roles)
CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    status platform_admin_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 4. RBAC TABLES
-- ==============================================================================

-- Roles (Organization-specific)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_role_name UNIQUE (organization_id, name)
);

-- Permissions (Platform-wide definitions)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role Permissions (Many-to-Many)
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Member Roles (Many-to-Many: Org Members <-> Roles)
CREATE TABLE member_roles (
    organization_member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (organization_member_id, role_id)
);


-- ==============================================================================
-- 5. STAFF TABLES
-- ==============================================================================

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NULL,
    manager_id UUID NULL, -- Will reference staff_profiles.id below
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    manager_id UUID NULL, -- Will reference staff_profiles.id below
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff Profiles
CREATE TABLE staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    organization_member_id UUID NULL REFERENCES organization_members(id) ON DELETE SET NULL,
    employee_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    profile_photo_url TEXT NULL,
    gender TEXT NULL,
    date_of_birth DATE NULL,
    job_title TEXT NOT NULL,
    department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
    team_id UUID NULL REFERENCES teams(id) ON DELETE SET NULL,
    manager_id UUID NULL REFERENCES staff_profiles(id) ON DELETE SET NULL,
    employment_type employment_type NOT NULL DEFAULT 'full_time',
    employment_status employment_status NOT NULL DEFAULT 'active',
    date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
    date_left DATE NULL,
    address TEXT NULL,
    emergency_contact JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_emp_number UNIQUE (organization_id, employee_number)
);

-- Circular FK constraints for Department and Team managers
ALTER TABLE departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES staff_profiles(id) ON DELETE SET NULL;
ALTER TABLE teams ADD CONSTRAINT fk_team_manager FOREIGN KEY (manager_id) REFERENCES staff_profiles(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_staff_org_id ON staff_profiles(organization_id);
CREATE INDEX idx_staff_emp_num ON staff_profiles(employee_number);
CREATE INDEX idx_staff_email ON staff_profiles(email);
CREATE INDEX idx_staff_dept ON staff_profiles(department_id);
CREATE INDEX idx_staff_team ON staff_profiles(team_id);
CREATE INDEX idx_staff_manager ON staff_profiles(manager_id);


-- ==============================================================================
-- 6. ATTENDANCE FOUNDATION TABLES
-- ==============================================================================

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    clock_in TIMESTAMPTZ NULL,
    clock_out TIMESTAMPTZ NULL,
    status attendance_status NOT NULL DEFAULT 'present',
    work_mode work_mode NOT NULL DEFAULT 'office',
    notes TEXT NULL,
    source attendance_source NOT NULL DEFAULT 'self',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_staff_date UNIQUE (organization_id, staff_id, attendance_date)
);

CREATE TABLE attendance_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_url TEXT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    successful_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    status batch_status NOT NULL DEFAULT 'pending',
    error_log JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 7. LEAVE FOUNDATION TABLES
-- ==============================================================================

CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NULL,
    default_days NUMERIC(5,2) NOT NULL DEFAULT 14.00,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    is_paid BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    allocated_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    used_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    pending_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    remaining_days NUMERIC(5,2) GENERATED ALWAYS AS (allocated_days - used_days - pending_days) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_leave_balance UNIQUE (organization_id, staff_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested NUMERIC(5,2) NOT NULL,
    reason TEXT NULL,
    status leave_request_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leave_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    approver_member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
    action leave_request_status NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 8. COMMUNICATION FOUNDATION TABLES
-- ==============================================================================

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority announcement_priority NOT NULL DEFAULT 'normal',
    status announcement_status NOT NULL DEFAULT 'published',
    publish_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE announcement_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    target_type target_type NOT NULL DEFAULT 'all',
    target_id UUID NULL
);


-- ==============================================================================
-- 9. NOTIFICATION FOUNDATION TABLES
-- ==============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notif_pref UNIQUE (organization_id, member_id, notification_type)
);

CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL DEFAULT 'in_app',
    status TEXT NOT NULL DEFAULT 'delivered',
    provider_message_id TEXT NULL,
    error_message TEXT NULL,
    sent_at TIMESTAMPTZ NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 10. DOCUMENT FOUNDATION TABLES
-- ==============================================================================

CREATE TABLE document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    category_id UUID NULL REFERENCES document_categories(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES organization_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 11. AUDIT LOGS TABLE
-- ==============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for platform-level events
    actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_member_id UUID NULL REFERENCES organization_members(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
