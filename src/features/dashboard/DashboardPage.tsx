import React from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import {
  MOCK_STAFF,
  MOCK_DEPARTMENTS,
  MOCK_ATTENDANCE,
  MOCK_LEAVE,
  MOCK_ANNOUNCEMENTS,
  MOCK_NOTIFICATIONS,
} from '@/lib/tenant/mockData';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import { Users, Clock, FileText, Bell, CalendarDays, Sparkles, ArrowRight, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';

const getRolePriority = (roleName?: string) => {
  if (!roleName) return 0;
  const map: Record<string, number> = {
    'Organization Admin': 4,
    'HR Manager': 3,
    Manager: 2,
    Staff: 1,
  };
  return map[roleName] ?? 0;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const DashboardPage: React.FC = () => {
  const { activeOrganization, activeRoles } = useTenant();

  const orgId = activeOrganization?.id || '';
  const currentStaff = MOCK_STAFF[orgId] || [];
  const currentDepts = MOCK_DEPARTMENTS[orgId] || [];
  const currentAttendance = MOCK_ATTENDANCE[orgId] || [];
  const currentLeave = MOCK_LEAVE[orgId] || [];
  const currentAnnouncements = MOCK_ANNOUNCEMENTS[orgId] || [];
  const unreadNotifications = (MOCK_NOTIFICATIONS[orgId] || []).filter((n) => !n.read_at).length;

  const roleName = [...activeRoles].sort((a, b) => getRolePriority(b.name) - getRolePriority(a.name))[0]?.name ?? 'Staff';
  const greeting = getGreeting();

  const attendanceSummary = {
    present: currentAttendance.filter((record) => record.status === 'present').length,
    late: currentAttendance.filter((record) => record.status === 'late').length,
    absent: currentAttendance.filter((record) => record.status === 'absent').length,
    notRecorded: Math.max(currentStaff.length - currentAttendance.length, 0),
  };

  const pendingLeave = currentLeave.filter((leave) => leave.status === 'pending').length;
  const approvedLeave = currentLeave.filter((leave) => leave.status === 'approved').length;
  const upcomingLeave = currentLeave.filter((leave) => leave.status !== 'rejected').slice(0, 2);
  const priorityAlerts = [
    pendingLeave > 0 ? `${pendingLeave} leave request${pendingLeave > 1 ? 's' : ''} awaiting review` : null,
    unreadNotifications > 0 ? `${unreadNotifications} notification${unreadNotifications > 1 ? 's' : ''} to review` : null,
  ].filter(Boolean) as string[];

  const headerLabel =
    roleName === 'Organization Admin'
      ? 'Organization overview'
      : roleName === 'HR Manager'
        ? 'HR overview'
        : roleName === 'Manager'
          ? 'Team overview'
          : 'My workday';

  const isAdmin = roleName === 'Organization Admin';
  const isHr = roleName === 'HR Manager';
  const isManager = roleName === 'Manager';
  const isStaffUser = roleName === 'Staff';

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{headerLabel}</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {greeting}, {activeOrganization?.name ? activeOrganization.name.split(' ')[0] : 'there'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Here&apos;s what&apos;s happening at {activeOrganization?.name || 'your organization'} today.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span>{activeOrganization?.name || 'Organization Portal'}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Total staff</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{currentStaff.length}</div>
            <p className="mt-1 text-[11px] text-slate-500">{currentDepts.length} active department{currentDepts.length === 1 ? '' : 's'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Today&apos;s attendance</CardTitle>
            <Clock className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{attendanceSummary.present}</div>
            <p className="mt-1 text-[11px] text-emerald-600">{Math.max(currentStaff.length ? Math.round((attendanceSummary.present / currentStaff.length) * 100) : 0, 0)}% present</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Pending leave</CardTitle>
            <CalendarDays className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingLeave}</div>
            <p className="mt-1 text-[11px] text-slate-500">{approvedLeave} approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Requires attention</CardTitle>
            <Bell className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{priorityAlerts.length}</div>
            <p className="mt-1 text-[11px] text-slate-500">Actionable items</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900">Attendance overview</CardTitle>
              <Badge variant="secondary" className="text-[10px]">Today</Badge>
            </div>
            <CardDescription>Actual attendance activity for the current organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="text-xs text-emerald-700">Present</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{attendanceSummary.present}</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs text-amber-700">Late</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{attendanceSummary.late}</div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                <div className="text-xs text-rose-700">Absent</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{attendanceSummary.absent}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-600">Not recorded</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{attendanceSummary.notRecorded}</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {currentAttendance.length === 0 ? (
                <>No attendance recorded yet for this organization.</>
              ) : (
                <>Attendance is being tracked for {currentAttendance.length} staff record{currentAttendance.length === 1 ? '' : 's'}.</>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">Requires attention</CardTitle>
            <CardDescription>Actionable items for the current role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityAlerts.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <span>Everything looks up to date.</span>
              </div>
            ) : (
              priorityAlerts.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>{item}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900">Leave overview</CardTitle>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <CardDescription>Pending and upcoming leave activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Pending</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{pendingLeave}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Approved</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{approvedLeave}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Upcoming</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{upcomingLeave.length}</div>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingLeave.length === 0 ? (
                <div className="text-sm text-slate-500">No upcoming leave requests.</div>
              ) : (
                upcomingLeave.map((leave) => (
                  <div key={leave.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{leave.reason || 'Leave request'}</div>
                      <div className="mt-1 text-slate-500">{leave.start_date} to {leave.end_date}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{leave.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-900">Announcements</CardTitle>
              <Sparkles className="h-4 w-4 text-violet-500" />
            </div>
            <CardDescription>Recent organization updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentAnnouncements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No announcements yet. Company updates will appear here when published.
              </div>
            ) : (
              currentAnnouncements.slice(0, 3).map((announcement) => (
                <div key={announcement.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{announcement.title}</div>
                    <Badge variant="outline" className="text-[10px]">{announcement.priority}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{announcement.content}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{announcement.publish_at ? new Date(announcement.publish_at).toLocaleDateString() : 'Recently published'}</span>
                    <button className="inline-flex items-center gap-1 font-medium text-indigo-600">
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {(isAdmin || isHr || isManager || isStaffUser) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">Organization snapshot</CardTitle>
            <CardDescription>Current staffing and activity summary for {activeOrganization?.name || 'your organization'}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Staff</div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{currentStaff.length}</div>
                <div className="mt-1 text-sm text-slate-500">Active records</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Attendance</div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{attendanceSummary.present}</div>
                <div className="mt-1 text-sm text-slate-500">Present today</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Notifications</div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{unreadNotifications}</div>
                <div className="mt-1 text-sm text-slate-500">Unread</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
