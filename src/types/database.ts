export type OrgStatus = 'active' | 'suspended';
export type MemberStatus = 'active' | 'invited' | 'suspended';
export type PlatformAdminStatus = 'active' | 'suspended';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary' | 'consultant';
export type EmploymentStatus = 'active' | 'inactive' | 'on_leave' | 'suspended' | 'terminated';

// Portal / Account login access status (independent of employment status)
export type AccountAccessStatus = 'no_account' | 'invited' | 'active' | 'suspended' | 'deactivated';

// Attendance Enums
export type AttendanceMethod = 'platform_clocking' | 'biometric_import';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday' | 'weekend' | 'incomplete';
export type WorkLocation = 'office' | 'remote' | 'field';
export type AttendanceSource = 'platform' | 'biometric' | 'manual';
export type EventType = 'clock_in' | 'clock_out' | 'manual_clock_in' | 'manual_clock_out' | 'biometric_clock_in' | 'biometric_clock_out';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  industry: string | null;
  country: string | null;
  timezone: string | null;
  status: OrgStatus;
  setup_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  default_work_start: string | null;
  default_work_end: string | null;
  attendance_enabled: boolean;
  attendance_method: AttendanceMethod;
  allow_remote: boolean;
  allow_field: boolean;
  require_clock_out: boolean;
  leave_enabled: boolean;
  notification_settings: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  status: MemberStatus;
  joined_at: string | null;
  created_at: string;
}

export interface PlatformAdmin {
  id: string;
  user_id: string;
  status: PlatformAdminStatus;
  created_at: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  module: string;
  description: string | null;
  created_at: string;
}

export interface StaffProfile {
  id: string;
  organization_id: string;
  organization_member_id: string | null;
  employee_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone: string;
  profile_photo_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
  job_title: string;
  department_id: string | null;
  team_id: string | null;
  manager_id: string | null;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  account_access_status?: AccountAccessStatus;
  date_joined: string;
  date_left: string | null;
  address: string | null;
  emergency_contact: EmergencyContact | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  staff_profile_id?: string | null;
  email: string;
  role_id: string;
  role_name: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager_name?: string | null;
  staff_count?: number;
}

export interface Team {
  id: string;
  organization_id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department_name?: string | null;
  manager_name?: string | null;
  staff_count?: number;
}

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  staff_id: string;
  attendance_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
  work_location: WorkLocation;
  source: AttendanceSource;
  total_hours: number | null;
  notes: string | null;
  original_clock_in?: string | null;
  original_clock_out?: string | null;
  correction_reason?: string | null;
  corrected_by?: string | null;
  corrected_at?: string | null;
  created_at: string;
  updated_at: string;
  staff_name?: string;
  employee_number?: string;
  department_name?: string;
  team_name?: string;
}

export interface AttendanceEvent {
  id: string;
  organization_id: string;
  attendance_record_id: string;
  staff_id: string;
  event_type: EventType;
  event_time: string;
  source: AttendanceSource;
  device_id: string | null;
  external_record_id: string | null;
  metadata: any | null;
  created_at: string;
}

export interface AttendanceImportBatch {
  id: string;
  organization_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  period_start: string | null;
  period_end: string | null;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: BatchStatus;
  created_at: string;
  completed_at: string | null;
}

export interface AttendanceImportError {
  id: string;
  import_batch_id: string;
  row_number: number;
  employee_reference: string;
  error_type: string;
  error_message: string;
  raw_data: any | null;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  organization_id: string;
  staff_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: LeaveRequestStatus;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publish_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  organization_id: string;
  recipient_member_id: string;
  type: string;
  title: string;
  message: string;
  data: any | null;
  read_at: string | null;
  created_at: string;
}

export interface StaffDocument {
  id: string;
  organization_id: string;
  staff_id: string;
  category_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_member_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: any | null;
  new_values: any | null;
  metadata: any | null;
  created_at: string;
}
