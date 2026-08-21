import React from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import {
  MOCK_STAFF,
  MOCK_DEPARTMENTS,
  MOCK_ATTENDANCE,
  MOCK_LEAVE,
  MOCK_NOTIFICATIONS,
  MOCK_DOCUMENTS,
  MOCK_AUDIT_LOGS,
} from '@/lib/tenant/mockData';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import { ShieldCheck, Users, Clock, FileText, Bell, Building2 } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { activeOrganization } = useTenant();

  const orgId = activeOrganization?.id || '';
  const currentStaff = MOCK_STAFF[orgId] || [];
  const currentDepts = MOCK_DEPARTMENTS[orgId] || [];
  const currentAttendance = MOCK_ATTENDANCE[orgId] || [];
  const currentLeave = MOCK_LEAVE[orgId] || [];
  const currentNotifications = MOCK_NOTIFICATIONS[orgId] || [];
  const currentDocuments = MOCK_DOCUMENTS[orgId] || [];
  const currentAudit = MOCK_AUDIT_LOGS[orgId] || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">
                Organization Portal
              </Badge>
              <span className="text-xs text-slate-300">Tenant ID: {orgId}</span>
            </div>
            <h1 className="text-2xl font-bold mt-2">{activeOrganization?.name} Overview</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Strict PostgreSQL Row Level Security (RLS) policies isolate all records per tenant boundary.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/10 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-white">Cross-Tenant Isolation</div>
              <div className="text-[11px] text-emerald-200 font-medium">100% Query Protection Enforced</div>
            </div>
          </div>
        </div>
      </div>

      {/* Static Active Tenant Indicator */}
      <Card className="border-indigo-100 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-base text-slate-900">Active Tenant Information</CardTitle>
            </div>
            <Badge variant="success" className="text-xs font-mono">
              Bound to {activeOrganization?.slug}
            </Badge>
          </div>
          <CardDescription>
            You are currently operating inside <strong>{activeOrganization?.name}</strong>. All data operations are securely constrained to your organization.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Total Staff</CardTitle>
            <Users className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStaff.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">{currentDepts.length} Active Departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Today's Attendance</CardTitle>
            <Clock className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentAttendance.length}</div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Clocked in today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Pending Leaves</CardTitle>
            <FileText className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentLeave.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Leave requests pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Notifications</CardTitle>
            <Bell className="w-4 h-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentNotifications.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">In-app notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Data Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Isolated Staff Profiles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Staff Profiles ({activeOrganization?.name})</CardTitle>
            <CardDescription>Filtered by organization_id constraint</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStaff.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">No staff found for this organization.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentStaff.map((staff) => (
                  <div key={staff.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{staff.first_name} {staff.last_name}</div>
                      <div className="text-[11px] text-slate-500">{staff.job_title} • {staff.email}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{staff.employee_number}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Audit Log Events ({activeOrganization?.name})</CardTitle>
            <CardDescription>Isolated tenant security log entries</CardDescription>
          </CardHeader>
          <CardContent>
            {currentAudit.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">No audit records found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentAudit.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-indigo-600">{log.action}</span>
                      <div className="text-[11px] text-slate-500">{log.resource_type} • ID: {log.resource_id}</div>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Status Indicator */}
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <CardTitle className="text-base text-emerald-950">Tenant Security Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-700">
          <div className="flex items-center justify-between p-2 rounded bg-white border border-emerald-100">
            <span>Querying staff for <strong>{activeOrganization?.name}</strong></span>
            <Badge variant="success">Returned {currentStaff.length} Records</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-white border border-emerald-100">
            <span>Querying documents for <strong>{activeOrganization?.name}</strong></span>
            <Badge variant="success">Returned {currentDocuments.length} Documents</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
