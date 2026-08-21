import type { Organization, StaffProfile, Department, Role, AttendanceRecord, LeaveRequest, Announcement, AppNotification, StaffDocument, AuditLog } from '@/types/database';

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Demo Realty A',
    slug: 'demo-realty-a',
    logo_url: null,
    industry: 'Real Estate Brokerage',
    country: 'United States',
    timezone: 'America/New_York',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Demo Realty B',
    slug: 'demo-realty-b',
    logo_url: null,
    industry: 'Real Estate Development',
    country: 'Canada',
    timezone: 'America/Toronto',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_ROLES: Record<string, Role[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'r-a1', organization_id: '11111111-1111-1111-1111-111111111111', name: 'Organization Admin', description: 'Full Org A control', is_system_role: true, created_at: '', updated_at: '' },
    { id: 'r-a2', organization_id: '11111111-1111-1111-1111-111111111111', name: 'HR Manager', description: 'Staff & HR management', is_system_role: true, created_at: '', updated_at: '' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'r-b1', organization_id: '22222222-2222-2222-2222-222222222222', name: 'Organization Admin', description: 'Full Org B control', is_system_role: true, created_at: '', updated_at: '' },
    { id: 'r-b2', organization_id: '22222222-2222-2222-2222-222222222222', name: 'Staff', description: 'Standard Employee', is_system_role: true, created_at: '', updated_at: '' },
  ],
};

/**
 * RBAC Permission Sets — per organization (determined by the user's assigned roles).
 *
 * Architecture note: permissions answer WHAT the user can do.
 * Scope (self / team / org) is enforced separately by RLS and application logic.
 *
 * ─── Org A: admin@demorealty.com ──────────────────────────────────────────────
 * Roles:  Organization Admin + HR Manager
 * Scope:  Entire organization
 *
 * ─── Org B: bob@demorealtyB.com ───────────────────────────────────────────────
 * Roles:  Organization Admin + Staff (demo seeding)
 * Scope:  Self (Staff role applied)
 */
export const MOCK_PERMISSIONS: Record<string, string[]> = {
  // ── Organization Admin + HR Manager (union of both role sets) ──────────────
  '11111111-1111-1111-1111-111111111111': [
    // Staff
    'staff.view', 'staff.create', 'staff.update', 'staff.archive',
    // Attendance
    'attendance.view', 'attendance.manage', 'attendance.import',
    // Leave
    'leave.view', 'leave.request', 'leave.approve',
    // Documents
    'documents.view', 'documents.upload', 'documents.delete',
    // Announcements
    'announcements.view', 'announcements.create', 'announcements.manage',
    // Reports
    'reports.view', 'reports.export',
    // Audit (Admin only)
    'audit_logs.view',
    // Organization management (Admin only)
    'organization.view', 'organization.update',
    'departments.view', 'departments.create', 'departments.update', 'departments.archive',
    'teams.view', 'teams.create', 'teams.update', 'teams.archive',
    'roles.view', 'roles.create', 'roles.update', 'roles.delete',
    // Settings (Admin only)
    'settings.view', 'settings.update',
  ],

  // ── Staff role permissions ─────────────────────────────────────────────────
  '22222222-2222-2222-2222-222222222222': [
    // Staff – limited company directory only; RLS scopes records to self/org
    'staff.view',
    // Attendance – own records only (enforced by RLS)
    'attendance.view',
    // Leave – own requests only
    'leave.view', 'leave.request',
    // Documents – own documents only (enforced by RLS)
    'documents.view',
    // Announcements – read-only
    'announcements.view',
    // NO: reports, audit_logs, settings, org management
  ],
};

export const MOCK_STAFF: Record<string, StaffProfile[]> = {
  '11111111-1111-1111-1111-111111111111': [
    {
      id: 'staff-a1',
      organization_id: '11111111-1111-1111-1111-111111111111',
      organization_member_id: 'mem-a1',
      employee_number: 'EMP-A001',
      first_name: 'Alice',
      middle_name: 'M.',
      last_name: 'Vance',
      email: 'alice@demorealtyA.com',
      phone: '+1 (555) 019-2831',
      profile_photo_url: null,
      gender: 'Female',
      date_of_birth: '1988-04-12',
      job_title: 'Principal Broker',
      department_id: 'dept-a1',
      team_id: 'team-a1',
      manager_id: null,
      employment_type: 'full_time',
      employment_status: 'active',
      date_joined: '2022-01-10',
      date_left: null,
      address: '100 Brokerage Way, New York, NY',
      emergency_contact: { name: 'John Vance', phone: '+1 555-9999', relation: 'Spouse' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'staff-a2',
      organization_id: '11111111-1111-1111-1111-111111111111',
      organization_member_id: 'mem-a2',
      employee_number: 'EMP-A002',
      first_name: 'Aaron',
      middle_name: null,
      last_name: 'Smith',
      email: 'aaron@demorealtyA.com',
      phone: '+1 (555) 019-2832',
      profile_photo_url: null,
      gender: 'Male',
      date_of_birth: '1992-09-24',
      job_title: 'HR Director',
      department_id: 'dept-a2',
      team_id: null,
      manager_id: 'staff-a1',
      employment_type: 'full_time',
      employment_status: 'active',
      date_joined: '2023-03-01',
      date_left: null,
      address: '250 Park Ave, New York, NY',
      emergency_contact: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  '22222222-2222-2222-2222-222222222222': [
    {
      id: 'staff-b1',
      organization_id: '22222222-2222-2222-2222-222222222222',
      organization_member_id: 'mem-b1',
      employee_number: 'EMP-B001',
      first_name: 'Bob',
      middle_name: 'R.',
      last_name: 'Builder',
      email: 'bob@demorealtyB.com',
      phone: '+1 (555) 020-4411',
      profile_photo_url: null,
      gender: 'Male',
      date_of_birth: '1985-11-03',
      job_title: 'Lead Development Manager',
      department_id: 'dept-b1',
      team_id: null,
      manager_id: null,
      employment_type: 'full_time',
      employment_status: 'active',
      date_joined: '2021-06-15',
      date_left: null,
      address: '777 Commercial Blvd, Toronto, ON',
      emergency_contact: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

export const MOCK_DEPARTMENTS: Record<string, Department[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'dept-a1', organization_id: '11111111-1111-1111-1111-111111111111', name: 'Sales & Brokerage', description: 'Residential & Commercial Brokerage Unit', manager_id: 'staff-a1', is_active: true, created_at: '', updated_at: '' },
    { id: 'dept-a2', organization_id: '11111111-1111-1111-1111-111111111111', name: 'Human Resources', description: 'Staffing, Payroll & Operations', manager_id: 'staff-a2', is_active: true, created_at: '', updated_at: '' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'dept-b1', organization_id: '22222222-2222-2222-2222-222222222222', name: 'Asset Development', description: 'Commercial Project Engineering', manager_id: 'staff-b1', is_active: true, created_at: '', updated_at: '' },
  ],
};

export const MOCK_ATTENDANCE: Record<string, AttendanceRecord[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'att-a1', organization_id: '11111111-1111-1111-1111-111111111111', staff_id: 'staff-a1', attendance_date: '2026-08-20', clock_in: '2026-08-20T08:58:00Z', clock_out: null, status: 'present', work_mode: 'office', notes: 'In office for client meeting', source: 'self', created_at: '', updated_at: '' },
    { id: 'att-a2', organization_id: '11111111-1111-1111-1111-111111111111', staff_id: 'staff-a2', attendance_date: '2026-08-20', clock_in: '2026-08-20T09:05:00Z', clock_out: null, status: 'present', work_mode: 'remote', notes: 'Working remotely today', source: 'self', created_at: '', updated_at: '' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'att-b1', organization_id: '22222222-2222-2222-2222-222222222222', staff_id: 'staff-b1', attendance_date: '2026-08-20', clock_in: '2026-08-20T08:25:00Z', clock_out: null, status: 'present', work_mode: 'field', notes: 'Onsite construction survey', source: 'self', created_at: '', updated_at: '' },
  ],
};

export const MOCK_LEAVE: Record<string, LeaveRequest[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'lv-a1', organization_id: '11111111-1111-1111-1111-111111111111', staff_id: 'staff-a2', leave_type_id: 'annual', start_date: '2026-09-01', end_date: '2026-09-05', days_requested: 5, reason: 'Annual summer vacation', status: 'pending', submitted_at: '2026-08-19T10:00:00Z', created_at: '', updated_at: '' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'lv-b1', organization_id: '22222222-2222-2222-2222-222222222222', staff_id: 'staff-b1', leave_type_id: 'sick', start_date: '2026-08-15', end_date: '2026-08-16', days_requested: 2, reason: 'Medical appointment', status: 'approved', submitted_at: '2026-08-14T09:00:00Z', created_at: '', updated_at: '' },
  ],
};

export const MOCK_ANNOUNCEMENTS: Record<string, Announcement[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'anc-a1', organization_id: '11111111-1111-1111-1111-111111111111', created_by: 'mem-a1', title: 'Q3 Real Estate Brokerage Townhall', content: 'Join us this Friday at 3 PM for our quarterly performance overview and new market strategy briefing.', priority: 'important', status: 'published', publish_at: '2026-08-18T12:00:00Z', expires_at: null, created_at: '', updated_at: '' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'anc-b1', organization_id: '22222222-2222-2222-2222-222222222222', created_by: 'mem-b1', title: 'Site Safety Protocol Update', content: 'Updated safety compliance guidelines for all commercial development projects are now effective.', priority: 'urgent', status: 'published', publish_at: '2026-08-10T09:00:00Z', expires_at: null, created_at: '', updated_at: '' },
  ],
};

export const MOCK_NOTIFICATIONS: Record<string, AppNotification[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'notif-a1', organization_id: '11111111-1111-1111-1111-111111111111', recipient_member_id: 'mem-a1', type: 'leave_request', title: 'New Leave Request', message: 'Aaron Smith submitted a leave request for 5 days.', data: null, read_at: null, created_at: '2026-08-19T10:01:00Z' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'notif-b1', organization_id: '22222222-2222-2222-2222-222222222222', recipient_member_id: 'mem-b1', type: 'system', title: 'Welcome to Demo Realty B', message: 'Your organization portal foundation is active.', data: null, read_at: '2026-08-15T11:00:00Z', created_at: '2026-08-15T10:00:00Z' },
  ],
};

export const MOCK_DOCUMENTS: Record<string, StaffDocument[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'doc-a1', organization_id: '11111111-1111-1111-1111-111111111111', staff_id: 'staff-a1', category_id: 'cat-license', file_name: 'Broker_License_2026.pdf', storage_path: 'staff-documents/11111111-1111-1111-1111-111111111111/staff-a1/doc-a1/Broker_License_2026.pdf', mime_type: 'application/pdf', file_size: 1048576, uploaded_by: 'mem-a1', created_at: '2026-01-15T09:00:00Z', updated_at: '2026-01-15T09:00:00Z' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'doc-b1', organization_id: '22222222-2222-2222-2222-222222222222', staff_id: 'staff-b1', category_id: 'cat-cert', file_name: 'Engineering_Certification.pdf', storage_path: 'staff-documents/22222222-2222-2222-2222-222222222222/staff-b1/doc-b1/Engineering_Certification.pdf', mime_type: 'application/pdf', file_size: 2097152, uploaded_by: 'mem-b1', created_at: '2026-02-10T14:00:00Z', updated_at: '2026-02-10T14:00:00Z' },
  ],
};

export const MOCK_AUDIT_LOGS: Record<string, AuditLog[]> = {
  '11111111-1111-1111-1111-111111111111': [
    { id: 'audit-a1', organization_id: '11111111-1111-1111-1111-111111111111', actor_user_id: 'usr-alice', actor_member_id: 'mem-a1', action: 'staff.created', resource_type: 'staff_profiles', resource_id: 'staff-a2', old_values: null, new_values: { name: 'Aaron Smith', job_title: 'HR Director' }, metadata: { ip: '192.168.1.50' }, created_at: '2026-08-19T14:30:00Z' },
  ],
  '22222222-2222-2222-2222-222222222222': [
    { id: 'audit-b1', organization_id: '22222222-2222-2222-2222-222222222222', actor_user_id: 'usr-bob', actor_member_id: 'mem-b1', action: 'organization.settings_updated', resource_type: 'organization_settings', resource_id: 'sett-b', old_values: { attendance_enabled: false }, new_values: { attendance_enabled: true }, metadata: { ip: '10.0.0.12' }, created_at: '2026-08-18T11:15:00Z' },
  ],
};
