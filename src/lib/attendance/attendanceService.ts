import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { staffService } from '@/lib/staff/staffService';
import { MOCK_ATTENDANCE } from '@/lib/tenant/mockData';
import type {
  AttendanceRecord,
  AttendanceEvent,
  OrganizationSettings,
  AttendanceMethod,
  WorkLocation,
  AttendanceStatus,
  AttendanceSource,
  AttendanceCorrectionRequest,
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

export interface RequestAttendanceCorrectionInput extends CorrectAttendanceInput {
  requestedByMemberId: string;
}

export interface ReviewAttendanceCorrectionInput {
  requestId: string;
  orgId: string;
  reviewerMemberId: string;
  decision: 'approved' | 'rejected';
  reviewReason?: string;
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
  allowMockFallback?: boolean;
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
const MOCK_CORRECTION_REQUESTS: Record<string, AttendanceCorrectionRequest[]> = {};

class AttendanceService {
  /**
   * Retrieves organization attendance settings.
   */
  async getAttendanceSettings(orgId: string, allowMockFallback = true): Promise<Partial<OrganizationSettings>> {
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error || !data) {
        if (!allowMockFallback && error) throw new Error(error.message);
        if (!allowMockFallback) return {};
        return MOCK_ATTENDANCE_SETTINGS[orgId] || {
          attendance_enabled: true,
          attendance_method: 'platform_clocking',
          allow_remote: true,
          allow_field: true,
          require_clock_out: true,
        };
      }
      return data;
    } catch (error) {
      if (!allowMockFallback) throw error;
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
    if (existingToday?.clock_in && existingToday.clock_out) {
      return { data: null, error: 'Today\'s attendance is already complete and cannot be restarted.' };
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
        id: crypto.randomUUID(),
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

    if (isSupabaseConfigured) {
      const payload = {
        organization_id: record.organization_id,
        staff_id: record.staff_id,
        attendance_date: record.attendance_date,
        clock_in: record.clock_in,
        clock_out: record.clock_out,
        status: record.status,
        work_mode: record.work_location,
        work_location: record.work_location,
        notes: record.notes,
        source: record.source,
        total_hours: record.total_hours,
        updated_at: record.updated_at,
      };
      const { data, error } = existingToday
        ? await supabase
            .from('attendance_records')
            .update(payload)
            .eq('id', existingToday.id)
            .eq('organization_id', input.orgId)
            .select('*')
            .single()
        : await supabase
            .from('attendance_records')
            .insert(payload)
            .select('*')
            .single();
      if (error || !data) return { data: null, error: 'Clock-in could not be saved. Please try again.' };
      record = data as AttendanceRecord;
    } else {
      this.saveRecord(input.orgId, record);
    }

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

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          clock_out: updatedRecord.clock_out,
          total_hours: updatedRecord.total_hours,
          notes: updatedRecord.notes,
          updated_at: updatedRecord.updated_at,
        })
        .eq('id', existing.id)
        .eq('organization_id', input.orgId)
        .select('*')
        .single();
      if (error || !data) return { data: null, error: 'Clock-out could not be saved. Please try again.' };
      Object.assign(updatedRecord, data as AttendanceRecord);
    } else {
      this.saveRecord(input.orgId, updatedRecord);
    }

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

  async requestAttendanceCorrection(
    input: RequestAttendanceCorrectionInput
  ): Promise<{ data: AttendanceCorrectionRequest | null; error?: string }> {
    if (!input.reason.trim()) return { data: null, error: 'A mandatory correction reason must be provided.' };

    const records = await this.getAllRecords(input.orgId);
    const existing = records.find((record) => record.id === input.recordId);
    if (!existing) return { data: null, error: 'Attendance record not found.' };

    const request: AttendanceCorrectionRequest = {
      id: crypto.randomUUID(),
      organization_id: input.orgId,
      attendance_record_id: existing.id,
      requested_by_member_id: input.requestedByMemberId,
      reviewed_by_member_id: null,
      original_clock_in: existing.clock_in,
      original_clock_out: existing.clock_out,
      requested_clock_in: input.newClockIn ?? existing.clock_in,
      requested_clock_out: input.newClockOut ?? existing.clock_out,
      requested_work_location: input.workLocation ?? existing.work_location,
      reason: input.reason.trim(),
      status: 'pending',
      review_reason: null,
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };

    if (!MOCK_CORRECTION_REQUESTS[input.orgId]) MOCK_CORRECTION_REQUESTS[input.orgId] = [];

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('attendance_correction_requests')
        .insert(request)
        .select('*')
        .single();
      if (error) return { data: null, error: 'Correction request could not be submitted.' };
      await auditService.logEvent({
        organizationId: input.orgId,
        actorMemberId: input.requestedByMemberId,
        action: 'attendance.correction_requested',
        resourceType: 'attendance_correction_requests',
        resourceId: data.id,
        newValues: { attendance_record_id: existing.id, reason: request.reason },
      });
      return { data: data as AttendanceCorrectionRequest };
    }

    MOCK_CORRECTION_REQUESTS[input.orgId].unshift(request);
    await auditService.logEvent({
      organizationId: input.orgId,
      actorMemberId: input.requestedByMemberId,
      action: 'attendance.correction_requested',
      resourceType: 'attendance_correction_requests',
      resourceId: request.id,
      newValues: { attendance_record_id: existing.id, reason: request.reason },
    });
    return { data: request };
  }

  async reviewAttendanceCorrection(
    input: ReviewAttendanceCorrectionInput
  ): Promise<{ data: AttendanceCorrectionRequest | null; error?: string }> {
    const requests = await this.getCorrectionRequests(input.orgId);
    const request = requests.find((item) => item.id === input.requestId);
    if (!request) return { data: null, error: 'Correction request not found.' };
    if (request.status !== 'pending') return { data: null, error: 'This correction request has already been reviewed.' };

    const reviewedAt = new Date().toISOString();
    const reviewedRequest = {
      ...request,
      status: input.decision,
      reviewed_by_member_id: input.reviewerMemberId,
      review_reason: input.reviewReason?.trim() || null,
      reviewed_at: reviewedAt,
    } satisfies AttendanceCorrectionRequest;

    if (isSupabaseConfigured) {
      const { data: reviewedId, error } = await supabase.rpc('review_attendance_correction', {
        p_request_id: request.id,
        p_decision: input.decision,
        p_review_reason: input.reviewReason || null,
      });
      if (error || !reviewedId) return { data: null, error: 'Correction request could not be reviewed.' };

      const { data, error: loadError } = await supabase
        .from('attendance_correction_requests')
        .select('*')
        .eq('id', reviewedId)
        .eq('organization_id', input.orgId)
        .single();
      if (loadError || !data) return { data: null, error: 'Correction review completed but the result could not be loaded.' };
      return { data: data as AttendanceCorrectionRequest };
    }

    const index = requests.findIndex((item) => item.id === request.id);
    MOCK_CORRECTION_REQUESTS[input.orgId][index] = reviewedRequest;
    if (input.decision === 'approved') {
      const correction = await this.correctAttendance({
        recordId: request.attendance_record_id,
        newClockIn: request.requested_clock_in,
        newClockOut: request.requested_clock_out,
        workLocation: request.requested_work_location || undefined,
        reason: request.reason,
        orgId: input.orgId,
        actorMemberId: input.reviewerMemberId,
      });
      if (correction.error) return { data: null, error: correction.error };
    }
    await auditService.logEvent({
      organizationId: input.orgId,
      actorMemberId: input.reviewerMemberId,
      action: input.decision === 'approved' ? 'attendance.correction_approved' : 'attendance.correction_rejected',
      resourceType: 'attendance_correction_requests',
      resourceId: request.id,
      oldValues: { status: 'pending' },
      newValues: { status: input.decision, review_reason: reviewedRequest.review_reason },
    });
    return { data: reviewedRequest };
  }

  async getCorrectionRequests(orgId: string): Promise<AttendanceCorrectionRequest[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('attendance_correction_requests')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw new Error('Unable to load attendance correction requests.');
      return (data || []) as AttendanceCorrectionRequest[];
    }
    return MOCK_CORRECTION_REQUESTS[orgId] || [];
  }

  /**
   * Direct correction used by an authorized reviewer after approval.
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
      currentDepartmentId,
      currentTeamId,
      allowMockFallback = true,
    } = params;

    if (isSupabaseConfigured) {
      const safePage = Math.max(page, 1);
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      let scopedStaffIds: string[] | undefined;

      if (userScope === 'self' && currentStaffId) {
        scopedStaffIds = [currentStaffId];
      } else if (userScope === 'team' || (departmentId && departmentId !== 'all') || (teamId && teamId !== 'all')) {
        const staffResult = await staffService.getStaffProfiles({
          orgId,
          userScope: userScope === 'team' ? 'team' : 'organization',
          currentStaffId,
          currentDepartmentId,
          currentTeamId,
          departmentId,
          teamId,
          page: 1,
          limit: 10000,
        });
        scopedStaffIds = staffResult.data
          .filter((staff) => userScope !== 'team' || staff.department_id === currentDepartmentId)
          .map((staff) => staff.id);
      }

      if (scopedStaffIds && scopedStaffIds.length === 0) {
        return { data: [], total: 0, page: safePage, limit: safeLimit, totalPages: 1 };
      }

      let query = supabase
        .from('attendance_records')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (scopedStaffIds) query = query.in('staff_id', scopedStaffIds);
      if (staffId && staffId !== 'all') query = query.eq('staff_id', staffId);
      if (startDate) query = query.gte('attendance_date', startDate);
      if (endDate) query = query.lte('attendance_date', endDate);
      if (status && status !== 'all') query = query.eq('status', status);
      if (workLocation && workLocation !== 'all') query = query.eq('work_location', workLocation);
      if (source && source !== 'all') query = query.eq('source', source);

      const from = (safePage - 1) * safeLimit;
      const { data, count, error } = await query.range(from, from + safeLimit - 1);
      if (error) return { data: [], total: 0, page: safePage, limit: safeLimit, totalPages: 1 };

      const total = count || 0;
      return {
        data: (data || []).map((record: any) => ({
          ...record,
          work_location: record.work_location || record.work_mode || 'office',
        })) as AttendanceRecord[],
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1,
      };
    }

    let list = await this.getAllRecords(orgId, allowMockFallback);

    // Scope rules
    if (userScope === 'self' && currentStaffId) {
      list = list.filter((r) => r.staff_id === currentStaffId);
    } else if (userScope === 'team') {
      if (!currentDepartmentId) {
        list = [];
      } else {
        const staffResult = await staffService.getStaffProfiles({
          orgId,
          userScope: 'organization',
          departmentId: currentDepartmentId,
          page: 1,
          limit: 10000,
        });
        const departmentStaffIds = new Set(staffResult.data.map((staff) => staff.id));
        list = list.filter((r) => departmentStaffIds.has(r.staff_id));
      }
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

  private async getAllRecords(orgId: string, allowMockFallback = true): Promise<AttendanceRecord[]> {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('organization_id', orgId);

      if (error) {
        if (!allowMockFallback || isSupabaseConfigured) throw new Error(error.message);
        return MOCK_ATTENDANCE[orgId] || [];
      }
      if (!data || data.length === 0) return isSupabaseConfigured || !allowMockFallback ? [] : (MOCK_ATTENDANCE[orgId] || []);
      return data;
    } catch (error) {
      if (!allowMockFallback || isSupabaseConfigured) throw error;
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
