import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { attendanceReportService } from '@/lib/attendance/attendanceReportService';
import type {
  MonthlyAttendanceSummary,
  AttendanceExceptionItem,
} from '@/lib/attendance/attendanceReportService';
import { attendanceService } from '@/lib/attendance/attendanceService';
import type { AttendanceRecord } from '@/types/database';
import { AttendanceLayout } from './AttendanceLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui';
import {
  BarChart3,
  Download,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Filter,
} from 'lucide-react';

export const AttendanceReportsPage: React.FC = () => {
  const { activeOrganization, activeRoles } = useTenant();
  const orgId = activeOrganization?.id || '';

  const isAdminOrHR = activeRoles.some(
    (r) => r.name === 'Organization Admin' || r.name === 'HR Manager'
  );
  const isManager = activeRoles.some((r) => r.name === 'Manager');
  const userScope: 'organization' | 'team' | 'self' = isAdminOrHR
    ? 'organization'
    : 'team';

  // Active Report Tab
  const [reportTab, setReportTab] = useState<'monthly' | 'exceptions' | 'daily'>('monthly');

  // Report Data
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlyAttendanceSummary[]>([]);
  const [exceptions, setExceptions] = useState<AttendanceExceptionItem[]>([]);
  const [dailyRecords, setDailyRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReportData = async () => {
    if (!orgId) return;
    setLoading(true);

    if (reportTab === 'monthly') {
      const data = await attendanceReportService.getMonthlySummaryReport({ orgId, userScope });
      setMonthlySummaries(data);
    } else if (reportTab === 'exceptions') {
      const data = await attendanceReportService.getExceptionReport({ orgId, userScope });
      setExceptions(data);
    } else if (reportTab === 'daily') {
      const res = await attendanceService.getAttendanceHistory({ orgId, userScope, limit: 100 });
      setDailyRecords(res.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReportData();
  }, [orgId, reportTab]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (reportTab === 'monthly') {
      const headers = [
        'Employee Number',
        'Staff Name',
        'Department',
        'Team',
        'Working Days',
        'Present Days',
        'Absent Days',
        'Late Days',
        'Remote Days',
        'Field Days',
        'Incomplete Days',
        'Total Hours',
      ];
      const rows = monthlySummaries.map((m) => [
        m.employeeNumber,
        m.staffName,
        m.departmentName,
        m.teamName,
        m.workingDays,
        m.presentDays,
        m.absentDays,
        m.lateDays,
        m.remoteDays,
        m.fieldDays,
        m.incompleteDays,
        m.totalHours,
      ]);
      attendanceReportService.exportToCSV(`Monthly_Attendance_Report_${new Date().toISOString().split('T')[0]}`, headers, rows);
    } else if (reportTab === 'exceptions') {
      const headers = ['Employee Number', 'Staff Name', 'Date', 'Exception Type', 'Details'];
      const rows = exceptions.map((e) => [e.employeeNumber, e.staffName, e.attendanceDate, e.exceptionType, e.details]);
      attendanceReportService.exportToCSV(`Attendance_Exceptions_Report_${new Date().toISOString().split('T')[0]}`, headers, rows);
    } else {
      const headers = ['Date', 'Staff ID', 'Clock In', 'Clock Out', 'Hours', 'Location', 'Status', 'Source'];
      const rows = dailyRecords.map((d) => [
        d.attendance_date,
        d.staff_id,
        d.clock_in || '',
        d.clock_out || '',
        d.total_hours || 0,
        d.work_location,
        d.status,
        d.source,
      ]);
      attendanceReportService.exportToCSV(`Daily_Attendance_Log_${new Date().toISOString().split('T')[0]}`, headers, rows);
    }
  };

  return (
    <AttendanceLayout>
      <div className="space-y-6">
        {/* Report Header Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReportTab('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                reportTab === 'monthly' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Monthly Summary Report
            </button>
            <button
              onClick={() => setReportTab('exceptions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                reportTab === 'exceptions' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Exception Report
            </button>
            <button
              onClick={() => setReportTab('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                reportTab === 'daily' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Daily Log Audit
            </button>
          </div>

          <Button size="sm" onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <Download size={14} className="mr-1.5" /> Export Report (CSV)
          </Button>
        </div>

        {/* ── TAB: MONTHLY ATTENDANCE SUMMARY ────────────────────────────── */}
        {reportTab === 'monthly' && (
          <Card className="border-slate-200 overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Monthly Attendance Breakdown per Employee
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Emp #</th>
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4 text-center">Work Days</th>
                    <th className="py-2.5 px-4 text-center">Present</th>
                    <th className="py-2.5 px-4 text-center">Absent</th>
                    <th className="py-2.5 px-4 text-center">Late</th>
                    <th className="py-2.5 px-4 text-center">Remote</th>
                    <th className="py-2.5 px-4 text-center">Field</th>
                    <th className="py-2.5 px-4 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={10} className="py-12 text-center text-slate-400">Computing monthly report statistics…</td></tr>
                  ) : monthlySummaries.length === 0 ? (
                    <tr><td colSpan={10} className="py-12 text-center text-slate-400">No attendance data available for monthly reporting.</td></tr>
                  ) : (
                    monthlySummaries.map((m) => (
                      <tr key={m.staffId} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-600">{m.employeeNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{m.staffName}</td>
                        <td className="py-3 px-4 text-slate-600">{m.departmentName}</td>
                        <td className="py-3 px-4 text-center font-mono">{m.workingDays}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">{m.presentDays}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">{m.absentDays}</td>
                        <td className="py-3 px-4 text-center font-mono text-amber-600">{m.lateDays}</td>
                        <td className="py-3 px-4 text-center font-mono text-indigo-600">{m.remoteDays}</td>
                        <td className="py-3 px-4 text-center font-mono text-blue-600">{m.fieldDays}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{m.totalHours} hrs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── TAB: EXCEPTION REPORT ───────────────────────────────────────── */}
        {reportTab === 'exceptions' && (
          <Card className="border-slate-200 overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" /> Attendance Exception Log
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Emp #</th>
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4">Exception Type</th>
                    <th className="py-2.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400">Checking exception rules…</td></tr>
                  ) : exceptions.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-emerald-600 font-semibold">No attendance exceptions detected!</td></tr>
                  ) : (
                    exceptions.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold">{ex.attendanceDate}</td>
                        <td className="py-3 px-4 font-mono">{ex.employeeNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{ex.staffName}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                            {ex.exceptionType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{ex.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── TAB: DAILY LOG AUDIT ────────────────────────────────────────── */}
        {reportTab === 'daily' && (
          <Card className="border-slate-200 overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">Daily Log Audit</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Clock In</th>
                    <th className="py-2.5 px-4">Clock Out</th>
                    <th className="py-2.5 px-4">Hours</th>
                    <th className="py-2.5 px-4">Location</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyRecords.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono">{d.attendance_date}</td>
                      <td className="py-2.5 px-4 font-mono">{d.clock_in ? new Date(d.clock_in).toLocaleTimeString() : '—'}</td>
                      <td className="py-2.5 px-4 font-mono">{d.clock_out ? new Date(d.clock_out).toLocaleTimeString() : '—'}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-indigo-600">{d.total_hours || '—'}</td>
                      <td className="py-2.5 px-4 capitalize">{d.work_location}</td>
                      <td className="py-2.5 px-4"><Badge variant="outline" className="text-[9px] capitalize">{d.status}</Badge></td>
                      <td className="py-2.5 px-4 font-mono uppercase text-[9px] text-slate-400">{d.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AttendanceLayout>
  );
};
