import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { attendanceService } from '@/lib/attendance/attendanceService';
import type { GetAttendanceResult } from '@/lib/attendance/attendanceService';
import { staffService } from '@/lib/staff/staffService';
import type { AttendanceRecord, Department, Team, StaffProfile } from '@/types/database';
import { AttendanceLayout } from './AttendanceLayout';
import { AttendanceCorrectionsModal } from './AttendanceCorrectionsModal';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Building2,
  MapPin,
  Clock,
  Filter,
  CheckCircle2,
} from 'lucide-react';

export const AttendanceHistoryPage: React.FC = () => {
  const { activeOrganization, activeRoles } = useTenant();
  const orgId = activeOrganization?.id || '';

  const isAdminOrHR = activeRoles.some(
    (r) => r.name === 'Organization Admin' || r.name === 'HR Manager'
  );
  const isManager = activeRoles.some((r) => r.name === 'Manager');
  const userScope: 'organization' | 'team' | 'self' = isAdminOrHR
    ? 'organization'
    : isManager
    ? 'team'
    : 'self';

  // Filters & State
  const [result, setResult] = useState<GetAttendanceResult>({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [teamId, setTeamId] = useState('all');
  const [status, setStatus] = useState('all');
  const [workLocation, setWorkLocation] = useState('all');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(1);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);

  // Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [recordToCorrect, setRecordToCorrect] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    if (!orgId) return;
    staffService.getDepartments(orgId).then(setDepartments);
    staffService.getTeams(orgId).then(setTeams);
    staffService.getStaffProfiles({ orgId, limit: 1000 }).then((r) => setStaffList(r.data));
  }, [orgId]);

  const fetchHistory = async () => {
    if (!orgId) return;
    setLoading(true);

    const res = await attendanceService.getAttendanceHistory({
      orgId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      departmentId,
      teamId,
      status,
      workLocation,
      source,
      page,
      limit: 10,
      userScope,
    });

    setResult(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [orgId, startDate, endDate, departmentId, teamId, status, workLocation, source, page]);

  return (
    <AttendanceLayout>
      <div className="space-y-4">
        {/* Filter Card */}
        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Start Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                />
              </div>

              {/* Department */}
              {isAdminOrHR && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
                    className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Location</label>
                <select
                  value={workLocation}
                  onChange={(e) => { setWorkLocation(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Locations</option>
                  <option value="office">Office</option>
                  <option value="remote">Remote</option>
                  <option value="field">Field</option>
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Source</label>
                <select
                  value={source}
                  onChange={(e) => { setSource(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Sources</option>
                  <option value="platform">Platform</option>
                  <option value="biometric">Biometric</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Clock In</th>
                  <th className="py-3 px-4">Clock Out</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Source</th>
                  {(isAdminOrHR || isManager) && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-400">Loading attendance history…</td></tr>
                ) : result.data.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-400">No attendance records found matching filters.</td></tr>
                ) : (
                  result.data.map((rec) => {
                    const s = staffList.find((st) => st.id === rec.staff_id);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{rec.attendance_date}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{s ? `${s.first_name} ${s.last_name}` : 'Staff Member'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{s?.employee_number}</div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-600">
                          {rec.total_hours ? `${rec.total_hours} hrs` : '—'}
                        </td>
                        <td className="py-3 px-4 capitalize font-medium text-slate-700">{rec.work_location}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={rec.status === 'present' ? 'success' : rec.status === 'late' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                            {rec.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-500 uppercase">{rec.source}</td>
                        {(isAdminOrHR || isManager) && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => { setRecordToCorrect(rec); setCorrectionModalOpen(true); }}
                              title="Correct Attendance Record"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
                            >
                              <Edit3 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page <span className="font-semibold text-slate-800">{result.page}</span> of{' '}
              <span className="font-semibold text-slate-800">{result.totalPages}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= result.totalPages || loading} onClick={() => setPage(page + 1)}>
                Next <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Corrections Modal */}
      <AttendanceCorrectionsModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        onSuccess={fetchHistory}
        record={recordToCorrect}
        orgId={orgId}
      />
    </AttendanceLayout>
  );
};
