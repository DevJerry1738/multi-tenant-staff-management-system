import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { attendanceService } from '@/lib/attendance/attendanceService';
import { staffService } from '@/lib/staff/staffService';
import type { AttendanceRecord, StaffProfile, WorkLocation } from '@/types/database';
import { AttendanceLayout } from './AttendanceLayout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import {
  Clock,
  Play,
  Square,
  Building2,
  MapPin,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Users,
  UserCheck,
  UserX,
  FileSpreadsheet,
} from 'lucide-react';

export const TodayAttendancePage: React.FC = () => {
  const { activeOrganization, activeRoles } = useTenant();
  const { user } = useAuth();
  const orgId = activeOrganization?.id || '';

  const isAdminOrHR = activeRoles.some(
    (r) => r.name === 'Organization Admin' || r.name === 'HR Manager'
  );
  const isManager = activeRoles.some((r) => r.name === 'Manager');

  // Staff State
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocation>('office');
  const [notes, setNotes] = useState('');
  const [clockingLoading, setClockingLoading] = useState(false);
  const [clockError, setClockError] = useState<string | null>(null);

  // Admin/Manager State
  const [todayList, setTodayList] = useState<AttendanceRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load current staff profile & today's data
  const loadTodayData = async () => {
    if (!orgId) return;
    setLoading(true);

    const allStaff = await staffService.getStaffProfiles({ orgId, limit: 1000 });
    setStaffList(allStaff.data);

    // Identify current user staff profile by email match
    const myProfile = allStaff.data.find(
      (s) => s.email.toLowerCase() === (user?.email || '').toLowerCase()
    ) || allStaff.data[0];

    setCurrentStaff(myProfile);

    const history = await attendanceService.getAttendanceHistory({ orgId, limit: 1000 });
    const todayStr = new Date().toISOString().split('T')[0];

    const todayRecords = history.data.filter((r) => r.attendance_date === todayStr);
    setTodayList(todayRecords);

    if (myProfile) {
      const myToday = todayRecords.find((r) => r.staff_id === myProfile.id);
      setTodayRecord(myToday || null);
      if (myToday?.work_location) setWorkLocation(myToday.work_location);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTodayData();
  }, [orgId, user]);

  // Handlers for Staff Clock In / Clock Out
  const handleClockIn = async () => {
    if (!currentStaff) return;
    setClockingLoading(true);
    setClockError(null);

    const res = await attendanceService.clockIn({
      orgId,
      staffId: currentStaff.id,
      workLocation,
      notes,
    });

    setClockingLoading(false);
    if (res.error) {
      setClockError(res.error);
    } else {
      setTodayRecord(res.data);
      setNotes('');
      loadTodayData();
    }
  };

  const handleClockOut = async () => {
    if (!currentStaff) return;
    setClockingLoading(true);
    setClockError(null);

    const res = await attendanceService.clockOut({
      orgId,
      staffId: currentStaff.id,
      notes,
    });

    setClockingLoading(false);
    if (res.error) {
      setClockError(res.error);
    } else {
      setTodayRecord(res.data);
      setNotes('');
      loadTodayData();
    }
  };

  // Summary counts for Admin/Manager dashboard
  const presentCount = todayList.filter((r) => r.status === 'present' || r.status === 'late').length;
  const lateCount = todayList.filter((r) => r.status === 'late').length;
  const remoteCount = todayList.filter((r) => r.work_location === 'remote').length;
  const fieldCount = todayList.filter((r) => r.work_location === 'field').length;
  const incompleteCount = todayList.filter((r) => r.clock_in && !r.clock_out).length;
  const absentCount = Math.max(0, staffList.length - presentCount);

  return (
    <AttendanceLayout>
      <div className="space-y-6">
        {/* ── 1. STAFF SELF-SERVICE CLOCKING CARD ──────────────────────────── */}
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Left Column: Clock State & Staff Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono border-indigo-400/30 text-indigo-300">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Badge>
                  {todayRecord?.clock_in && !todayRecord.clock_out && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Clocked In
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-white">
                  Welcome, {currentStaff ? `${currentStaff.first_name} ${currentStaff.last_name}` : 'Staff Member'}
                </h2>
                <p className="text-xs text-slate-300">
                  {currentStaff?.job_title} · {activeOrganization?.name}
                </p>

                {/* Clock Status Badges */}
                <div className="flex flex-wrap items-center gap-4 text-xs pt-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Clock In</span>
                    <span className="font-mono text-sm font-semibold text-white">
                      {todayRecord?.clock_in ? new Date(todayRecord.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Clock Out</span>
                    <span className="font-mono text-sm font-semibold text-white">
                      {todayRecord?.clock_out ? new Date(todayRecord.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Hours</span>
                    <span className="font-mono text-sm font-semibold text-emerald-300">
                      {todayRecord?.total_hours ? `${todayRecord.total_hours} hrs` : '0.00 hrs'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Clocking Action Box */}
              <div className="w-full md:w-auto bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 space-y-3 shrink-0">
                {clockError && (
                  <div className="p-2 rounded bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-1.5">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{clockError}</span>
                  </div>
                )}

                {/* Work Location Selector (Only active before Clock-In) */}
                {!todayRecord?.clock_in && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">
                      Work Location
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setWorkLocation('office')}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          workLocation === 'office' ? 'bg-indigo-600 text-white shadow' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        <Building2 size={12} /> Office
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkLocation('remote')}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          workLocation === 'remote' ? 'bg-indigo-600 text-white shadow' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        <Laptop size={12} /> Remote
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkLocation('field')}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          workLocation === 'field' ? 'bg-indigo-600 text-white shadow' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        <MapPin size={12} /> Field
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!todayRecord?.clock_in ? (
                  <Button
                    onClick={handleClockIn}
                    disabled={clockingLoading}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30"
                  >
                    <Play size={16} className="mr-2 fill-current" />
                    {clockingLoading ? 'Clocking In...' : 'Clock In Now'}
                  </Button>
                ) : !todayRecord.clock_out ? (
                  <Button
                    onClick={handleClockOut}
                    disabled={clockingLoading}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-lg shadow-rose-500/30"
                  >
                    <Square size={16} className="mr-2 fill-current" />
                    {clockingLoading ? 'Clocking Out...' : 'Clock Out Now'}
                  </Button>
                ) : (
                  <div className="text-center py-2 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 size={16} className="mx-auto mb-1" />
                    Today's shift completed
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 2. ADMIN / MANAGER SUMMARY CARDS ───────────────────────────── */}
        {(isAdminOrHR || isManager) && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-slate-200">
                <CardContent className="p-3 text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Present</div>
                  <div className="text-xl font-bold text-emerald-600 mt-0.5">{presentCount}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-3 text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Late</div>
                  <div className="text-xl font-bold text-amber-600 mt-0.5">{lateCount}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-3 text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Absent</div>
                  <div className="text-xl font-bold text-rose-600 mt-0.5">{absentCount}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-3 text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Remote</div>
                  <div className="text-xl font-bold text-indigo-600 mt-0.5">{remoteCount}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-3 text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Field</div>
                  <div className="text-xl font-bold text-blue-600 mt-0.5">{fieldCount}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-3 text-center">
                  <div className="text-slate-400 text-[10px] uppercase font-bold">Incomplete</div>
                  <div className="text-xl font-bold text-purple-600 mt-0.5">{incompleteCount}</div>
                </CardContent>
              </Card>
            </div>

            {/* Today's Live Attendance Table */}
            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                  <span>Today's Staff Log</span>
                  <span className="font-mono text-slate-400 text-[11px]">{todayList.length} records logged</span>
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold">
                      <th className="py-2.5 px-4">Staff Member</th>
                      <th className="py-2.5 px-4">Clock In</th>
                      <th className="py-2.5 px-4">Clock Out</th>
                      <th className="py-2.5 px-4">Hours</th>
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-center">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading today's attendance log...</td></tr>
                    ) : todayList.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-400">No attendance punches recorded for today yet.</td></tr>
                    ) : (
                      todayList.map((rec) => {
                        const s = staffList.find((st) => st.id === rec.staff_id);
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {s ? `${s.first_name} ${s.last_name}` : 'Staff Member'}
                              <span className="block text-[10px] text-slate-400 font-normal">{s?.job_title}</span>
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
                            <td className="py-3 px-4 capitalize font-medium text-slate-700">
                              {rec.work_location}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant={rec.status === 'present' ? 'success' : rec.status === 'late' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                                {rec.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-500 uppercase">
                              {rec.source}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AttendanceLayout>
  );
};
