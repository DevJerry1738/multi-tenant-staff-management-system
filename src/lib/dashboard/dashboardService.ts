import { attendanceService } from '@/lib/attendance/attendanceService';
import { staffService } from '@/lib/staff/staffService';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { MOCK_ANNOUNCEMENTS, MOCK_LEAVE, MOCK_NOTIFICATIONS } from '@/lib/tenant/mockData';
import type { Announcement, AttendanceRecord, Department, LeaveRequest, OrganizationSettings, StaffProfile } from '@/types/database';

export interface DashboardQuery {
  orgId: string;
  userScope: 'organization' | 'team' | 'self';
  currentStaffId?: string;
  currentMemberId?: string;
  currentDepartmentId?: string;
  currentTeamId?: string;
}

export interface DashboardData {
  staff: StaffProfile[];
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  announcements: Announcement[];
  departments: Department[];
  unreadNotifications: number;
  settings: Partial<OrganizationSettings>;
}

class DashboardService {
  async getDashboardData(query: DashboardQuery): Promise<DashboardData> {
    const staffResult = await staffService.getStaffProfiles({
      orgId: query.orgId,
      userScope: query.userScope,
      currentStaffId: query.currentStaffId,
      currentDepartmentId: query.currentDepartmentId,
      currentTeamId: query.currentTeamId,
      page: 1,
      limit: 500,
    });

    const staff = staffResult.data;
    const departments = await staffService.getDepartments(query.orgId);
    const staffIds = staff.map((profile) => profile.id);
    const attendanceResult = await attendanceService.getAttendanceHistory({
      orgId: query.orgId,
      userScope: query.userScope,
      currentStaffId: query.currentStaffId,
      currentDepartmentId: query.currentDepartmentId,
      currentTeamId: query.currentTeamId,
      page: 1,
      limit: 500,
    });

    const [leave, announcements, unreadNotifications, settings] = await Promise.all([
      this.getLeave(query.orgId, staffIds),
      this.getAnnouncements(query.orgId),
      this.getUnreadNotifications(query.orgId, query.currentMemberId),
      attendanceService.getAttendanceSettings(query.orgId, false),
    ]);

    return {
      staff,
      attendance: attendanceResult.data,
      leave,
      announcements,
      departments,
      unreadNotifications,
      settings,
    };
  }

  private async getUnreadNotifications(orgId: string, memberId?: string): Promise<number> {
    if (!isSupabaseConfigured) {
      return (MOCK_NOTIFICATIONS[orgId] || []).filter((notification) => !notification.read_at).length;
    }

    if (!memberId) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('recipient_member_id', memberId)
      .is('read_at', null);

    if (error) throw new Error(error.message);
    return count || 0;
  }

  private async getLeave(orgId: string, staffIds: string[]): Promise<LeaveRequest[]> {
    if (!isSupabaseConfigured) {
      return (MOCK_LEAVE[orgId] || []).filter((leave) => staffIds.includes(leave.staff_id));
    }

    if (staffIds.length === 0) return [];

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('organization_id', orgId)
      .in('staff_id', staffIds)
      .order('start_date', { ascending: true })
      .limit(100);

    if (error) throw new Error(error.message);
    return (data || []) as LeaveRequest[];
  }

  private async getAnnouncements(orgId: string): Promise<Announcement[]> {
    if (!isSupabaseConfigured) {
      return MOCK_ANNOUNCEMENTS[orgId] || [];
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'published')
      .order('publish_at', { ascending: false })
      .limit(3);

    if (error) throw new Error(error.message);
    return (data || []) as Announcement[];
  }
}

export const dashboardService = new DashboardService();
