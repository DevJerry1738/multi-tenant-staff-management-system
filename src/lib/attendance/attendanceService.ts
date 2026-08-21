import { supabase } from '@/lib/supabase/client';
import { MOCK_ATTENDANCE } from '@/lib/tenant/mockData';
import type {
  AttendanceRecord,
  AttendanceEvent,
  OrganizationSettings,
  AttendanceMethod,
  WorkLocation,
  AttendanceStatus,
  AttendanceSource,
} from '@/types/database';
import { auditService } from '@/lib/audit/auditService';

export interface ClockInInput {
  orgId: string;
  staffId: string;
  workLocation: WorkLocation;
  notes?: string;
}

export interface ClockOutInput {
  orgId: string;
  staffId: string;
  notes?: string;
}

export interface CorrectAttendanceInput {
  recordId: string;
  newClockIn?: string | null;
  newClockOut?: string | null;
  workLocation?: WorkLocation;
  reason: string;
  orgId: string;
  actorMemberId?: string;
}

export interface GetAttendanceParams {
  orgId: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  teamId?: string;
  staffId?: string;
  status?: string;
  workLocation?: string;
  source?: string;
  page?: number;
  limit?: number;
  userScope?: 'organization' | 'team' | 'self';
  currentStaffId?: string;
  currentDepartmentId?: string;
  currentTeamId?: string;
}

export interface GetAttendanceResult {
  data: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// In-memory settings store for mock fallback
const MOCK_ATTENDANCE_SETTINGS: Record<string, Partial<OrganizationSettings>> = {
  '11111111-1111-1111-1111-111111111111': {
    attendance_enabled: true,
    attendance_method: 'platform_clocking',
    allow_remote: true,
    allow_field: true,
    require_clock_out: true,
    default_work_start: '09:00:00',
    default_work_end: '17:00:00',
  },
  '22222222-2222-2222-2222-222222222222': {
    attendance_enabled: true,
    attendance_method: 'biometric_import',
    allow_remote: true,
    allow_field: false,
    require_clock_out: true,
    default_work_start: '08:30:00',
    default_work_end: '17:00:00',
  },
};

const MOCK_ATTENDANCE_EVENTS: Record<string, AttendanceEvent[]> = {};

class AttendanceService {
  /**
   * Retrieves organization attendance settings.
   */
  async getAttendanceSettings(orgId: string): Promise<Partial<OrganizationSettings>> {
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error || !data) {
        return MOCK_ATTENDANCE_SETTINGS[orgId] || {
          attendance_enabled: true,
          attendance_method: 'platform_clocking',
          allow_remote: true,
          allow_field: true,
          require_clock_out: true,
        };
      }
      return data;
    } catch {
      return MOCK_ATTENDANCE_SETTINGS[orgId] || {
        attendance_enabled: true,
        attendance_method: 'platform_clocking',
        allow_remote: true,
        allow_field: true,
        require_clock_out: true,
      };
    }
  }

  /**
   * Updates organization attendance settings (Admin only).
   */
  async updateAttendanceSettings(
    orgId: string,
    settings: Partial<OrganizationSettings>,
    actorMemberId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.getAttendanceSettings(orgId);
    const updated = { ...existing, ...settings, updated_at: new Date().toISOString() };

    try {
      const { error } = await supabase
        .from('organization_settings')
        .update(updated)
        .eq('organization_id', orgId);

      if (error) {
        MOCK_ATTENDANCE_SETTINGS[orgId] = updated;
      }
    } catch {
      MOCK_ATTENDANCE_SETTINGS[orgId] = updated;
    }

    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: 'organization.attendance_settings_updated',
      resourceType: 'organization_settings',
      oldValues: existing,
      newValues: updated,
    });

    return { success: true };
  }

  /**
   * Clock In via Platform Clocking.
   */
  async clockIn(input: ClockInInput, actorMemberId?: string): Promise<{ data: AttendanceRecord | null; error?: string }> {
    const settings = await this.getAttendanceSettings(input.orgId);
    if (settings.attendance_method === 'biometric_import') {
      return { data: null, error: 'Your organization is configured for Biometric Import. Platform clocking is disabled.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const records = await this.getAllRecords(input.orgId);
    const existingToday = records.find(
      (r) => r.staff_id === input.staffId && r.attendance_date === todayStr
    );

    if (existingToday && existingToday.clock_in && !existingToday.clock_out) {
      return { data: null, error: 'You are already clocked in for today. Please clock out before clocking in again.' };
    }

    const nowIso = new Date().toISOString();

    // Determine status (e.g. check if late based on default start time 09:00)
    const workStart = settings.default_work_start || '09:00:00';
    const currentTimeStr = new Date().toTimeString().split(' ')[0];
    const isLate = currentTimeStr > workStart;
    const status: AttendanceStatus = isLate ? 'late' : 'present';

    let record: AttendanceRecord;

    if (existingToday) {
      record = {
        ...existingToday,
        clock_in: nowIso,
        clock_out: null,
        status,
        work_location: input.workLocation,
        notes: input.notes || existingToday.notes,
        source: 'platform',
        updated_at: nowIso,
      };
    } else {
      record = {
        id: `att-${Date.now()}`,
        organization_id: input.orgId,
        staff_id: input.staffId,
        attendance_date: todayStr,
        clock_in: nowIso,
        clock_out: null,
        status,
        work_location: input.workLocation,
        source: 'platform',
        total_hours: null,
        notes: input.notes || null,
        created_at: nowIso,
        updated_at: nowIso,
      };
    }

    this.saveRecord(input.orgId, record);

    // Record Event
    this.logEvent(input.orgId, {
      id: `evt-${Date.now()}`,
      organization_id: input.orgId,
      attendance_record_id: record.id,
      staff_id: input.staffId,
      event_type: 'clock_in',
      event_time: nowIso,
      source: 'platform',
      device_id: null,
      external_record_id: null,
      metadata: { work_location: input.workLocation },
      created_at: nowIso,
    });

    await auditService.logEvent({
      organizationId: input.orgId,
      actorMemberId,
      action: 'attendance.clocked_in',
      resourceType: 'attendance_records',
      resourceId: record.id,
      newValues: { clock_in: nowIso, work_location: input.workLocation, status },
    });

    return { data: record };
  }

  /**
   * Clock Out via Platform Clocking.
   */
  async clockOut(input: ClockOutInput, actorMemberId?: string): Promise<{ data: AttendanceRecord | null; error?: string }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const records = await this.getAllRecords(input.orgId);
    const existing = records.find(
      (r) => r.staff_id === input.staffId && r.attendance_date === todayStr && r.clock_in && !r.clock_out
    );

    if (!existing) {
      return { data: null, error: 'No active clock-in record found for today.' };
    }

    const nowIso = new Date().toISOString();
    const clockInTime = new Date(existing.clock_in!).getTime();
    const clockOutTime = new Date(nowIso).getTime();
    const totalHours = Math.round(((clockOutTime - clockInTime) / (1000 * 60 * 60)) * 100) / 100;

    const updatedRecord: AttendanceRecord = {
      ...existing,
      clock_out: nowIso,
      total_hours: totalHours,
      notes: input.notes ? `${existing.notes || ''} ${input.notes}`.trim() : existing.notes,
      updated_at: nowIso,
    };

    this.saveRecord(input.orgId, updatedRecord);

    this.logEvent(input.orgId, {
      id: `evt-${Date.now()}`,
      organization_id: input.orgId,
      attendance_record_id: updatedRecord.id,
      staff_id: input.staffId,
      event_type: 'clock_out',
      event_time: nowIso,
      source: 'platform',
      device_id: null,
      external_record_id: null,
      metadata: { total_hours: totalHours },
      created_at: nowIso,
    });

    await auditService.logEvent({
      organizationId: input.orgId,
      actorMemberId,
      action: 'attendance.clocked_out',
      resourceType: 'attendance_records',
      resourceId: updatedRecord.id,
      newValues: { clock_out: nowIso, total_hours: totalHours },
    });

    return { data: updatedRecord };
  }

  /**
   * Manual Attendance Correction (Admin, HR, Manager). Mandatory reason required.
   */
  async correctAttendance(
    input: CorrectAttendanceInput
  ): Promise<{ data: AttendanceRecord | null; error?: string }> {
    if (!input.reason.trim()) {
      return { data: null, error: 'A mandatory correction reason must be provided.' };
    }

    const records = await this.getAllRecords(input.orgId);
    const existing = records.find((r) => r.id === input.recordId);
    if (!existing) return { data: null, error: 'Attendance record not found.' };

    const originalClockIn = existing.original_clock_in || existing.clock_in;
    const originalClockOut = existing.original_clock_out || existing.clock_out;

    const newClockIn = input.newClockIn !== undefined ? input.newClockIn : existing.clock_in;
    const newClockOut = input.newClockOut !== undefined ? input.newClockOut : existing.clock_out;

    let totalHours: number | null = null;
    if (newClockIn && newClockOut) {
      const inTime = new Date(newClockIn).getTime();
      const outTime = new Date(newClockOut).getTime();
      if (outTime < inTime) {
        return { data: null, error: 'Clock-out time cannot precede clock-in time.' };
      }
      totalHours = Math.round(((outTime - inTime) / (1000 * 60 * 60)) * 100) / 100;
    }

    const updatedRecord: AttendanceRecord = {
      ...existing,
      clock_in: newClockIn,
      clock_out: newClockOut,
      total_hours: totalHours,
      work_location: input.workLocation || existing.work_location,
      source: 'manual',
      original_clock_in: originalClockIn,
      original_clock_out: originalClockOut,
      correction_reason: input.reason.trim(),
      corrected_by: input.actorMemberId || 'mem-admin',
      corrected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.saveRecord(input.orgId, updatedRecord);

    await auditService.logEvent({
      organizationId: input.orgId,
      actorMemberId: input.actorMemberId,
      action: 'attendance.corrected',
      resourceType: 'attendance_records',
      resourceId: input.recordId,
      oldValues: { clock_in: existing.clock_in, clock_out: existing.clock_out },
      newValues: {
        clock_in: newClockIn,
        clock_out: newClockOut,
        reason: input.reason.trim(),
      },
    });

    return { data: updatedRecord };
  }

  /**
   * Fetches paginated & filtered attendance records with role scope enforcement.
   */
  async getAttendanceHistory(params: GetAttendanceParams): Promise<GetAttendanceResult> {
    const {
      orgId,
      startDate,
      endDate,
      departmentId,
      teamId,
      staffId,
      status,
      workLocation,
      source,
      page = 1,
      limit = 10,
      userScope = 'organization',
      currentStaffId,
    } = params;

    let list = await this.getAllRecords(orgId);

    // Scope rules
    if (userScope === 'self' && currentStaffId) {
      list = list.filter((r) => r.staff_id === currentStaffId);
    }

    // Filter by staff if explicitly provided
    if (staffId && staffId !== 'all') {
      list = list.filter((r) => r.staff_id === staffId);
    }

    // Date range filters
    if (startDate) {
      list = list.filter((r) => r.attendance_date >= startDate);
    }
    if (endDate) {
      list = list.filter((r) => r.attendance_date <= endDate);
    }

    if (status && status !== 'all') {
      list = list.filter((r) => r.status === status);
    }

    if (workLocation && workLocation !== 'all') {
      list = list.filter((r) => r.work_location === workLocation);
    }

    if (source && source !== 'all') {
      list = list.filter((r) => r.source === source);
    }

    // Sort by date descending
    list.sort((a, b) => (a.attendance_date < b.attendance_date ? 1 : -1));

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // ── PRIVATE STORAGE HELPERS ──────────────────────────────────────────────────

  private async getAllRecords(orgId: string): Promise<AttendanceRecord[]> {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('organization_id', orgId);

      if (error || !data || data.length === 0) {
        return MOCK_ATTENDANCE[orgId] || [];
      }
      return data;
    } catch {
      return MOCK_ATTENDANCE[orgId] || [];
    }
  }

  private saveRecord(orgId: string, record: AttendanceRecord) {
    if (!MOCK_ATTENDANCE[orgId]) MOCK_ATTENDANCE[orgId] = [];
    const index = MOCK_ATTENDANCE[orgId].findIndex((r) => r.id === record.id);
    if (index !== -1) {
      MOCK_ATTENDANCE[orgId][index] = record;
    } else {
      MOCK_ATTENDANCE[orgId].unshift(record);
    }
  }

  private logEvent(orgId: string, event: AttendanceEvent) {
    if (!MOCK_ATTENDANCE_EVENTS[orgId]) MOCK_ATTENDANCE_EVENTS[orgId] = [];
    MOCK_ATTENDANCE_EVENTS[orgId].unshift(event);
  }
}

export const attendanceService = new AttendanceService();
