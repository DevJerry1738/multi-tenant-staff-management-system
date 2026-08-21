import { attendanceService } from './attendanceService';
import type { GetAttendanceParams } from './attendanceService';
import { staffService } from '@/lib/staff/staffService';
import type { AttendanceRecord, StaffProfile } from '@/types/database';

export interface MonthlyAttendanceSummary {
  staffId: string;
  employeeNumber: string;
  staffName: string;
  departmentName: string;
  teamName: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  remoteDays: number;
  fieldDays: number;
  incompleteDays: number;
  totalHours: number;
}

export interface AttendanceExceptionItem {
  id: string;
  staffName: string;
  employeeNumber: string;
  attendanceDate: string;
  exceptionType: 'Missing Clock-In' | 'Missing Clock-Out' | 'Late Arrival' | 'Duplicate Punch' | 'Incomplete Attendance';
  details: string;
}

class AttendanceReportService {
  /**
   * Generates a monthly attendance summary aggregated per employee.
   */
  async getMonthlySummaryReport(params: GetAttendanceParams): Promise<MonthlyAttendanceSummary[]> {
    const orgId = params.orgId;
    const staffRes = await staffService.getStaffProfiles({ orgId, limit: 1000 });
    const depts = await staffService.getDepartments(orgId);
    const teams = await staffService.getTeams(orgId);
    const attRes = await attendanceService.getAttendanceHistory({ ...params, limit: 10000 });

    const summaryMap = new Map<string, MonthlyAttendanceSummary>();

    staffRes.data.forEach((s) => {
      const dept = depts.find((d) => d.id === s.department_id);
      const team = teams.find((t) => t.id === s.team_id);
      summaryMap.set(s.id, {
        staffId: s.id,
        employeeNumber: s.employee_number,
        staffName: `${s.first_name} ${s.last_name}`,
        departmentName: dept?.name || 'Unassigned',
        teamName: team?.name || '—',
        workingDays: 20, // Default working days benchmark
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        remoteDays: 0,
        fieldDays: 0,
        incompleteDays: 0,
        totalHours: 0,
      });
    });

    attRes.data.forEach((rec) => {
      const sum = summaryMap.get(rec.staff_id);
      if (!sum) return;

      if (rec.status === 'present') sum.presentDays++;
      if (rec.status === 'late') {
        sum.presentDays++;
        sum.lateDays++;
      }
      if (rec.status === 'absent') sum.absentDays++;
      if (rec.status === 'incomplete' || !rec.clock_out) sum.incompleteDays++;

      if (rec.work_location === 'remote') sum.remoteDays++;
      if (rec.work_location === 'field') sum.fieldDays++;

      if (rec.total_hours) sum.totalHours = Math.round((sum.totalHours + rec.total_hours) * 100) / 100;
    });

    return Array.from(summaryMap.values());
  }

  /**
   * Identifies attendance exceptions (missing punches, late arrivals, incomplete records).
   */
  async getExceptionReport(params: GetAttendanceParams): Promise<AttendanceExceptionItem[]> {
    const attRes = await attendanceService.getAttendanceHistory({ ...params, limit: 10000 });
    const staffRes = await staffService.getStaffProfiles({ orgId: params.orgId, limit: 1000 });
    const staffMap = new Map<string, StaffProfile>();
    staffRes.data.forEach((s) => staffMap.set(s.id, s));

    const exceptions: AttendanceExceptionItem[] = [];

    attRes.data.forEach((rec) => {
      const staff = staffMap.get(rec.staff_id);
      const staffName = staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown Staff';
      const employeeNumber = staff ? staff.employee_number : 'N/A';

      if (!rec.clock_in) {
        exceptions.push({
          id: `ex-in-${rec.id}`,
          staffName,
          employeeNumber,
          attendanceDate: rec.attendance_date,
          exceptionType: 'Missing Clock-In',
          details: 'Record exists without a clock-in timestamp.',
        });
      } else if (!rec.clock_out) {
        exceptions.push({
          id: `ex-out-${rec.id}`,
          staffName,
          employeeNumber,
          attendanceDate: rec.attendance_date,
          exceptionType: 'Missing Clock-Out',
          details: 'Employee clocked in but has no clock-out timestamp recorded.',
        });
      }

      if (rec.status === 'late') {
        exceptions.push({
          id: `ex-late-${rec.id}`,
          staffName,
          employeeNumber,
          attendanceDate: rec.attendance_date,
          exceptionType: 'Late Arrival',
          details: `Clocked in at ${rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString() : 'N/A'}.`,
        });
      }
    });

    return exceptions;
  }

  /**
   * Export records to downloadable CSV format.
   */
  exportToCSV(filename: string, headers: string[], data: (string | number)[][]) {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...data.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const attendanceReportService = new AttendanceReportService();
