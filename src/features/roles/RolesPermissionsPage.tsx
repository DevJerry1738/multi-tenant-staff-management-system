import React, { useState } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { ShieldCheck, Users, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Canonical permission registry — grouped by module.
 *
 * Every key here maps 1-to-1 with the database `permissions` table rows.
 * Scope (self / team / org) is enforced separately by RLS + application logic,
 * NOT by creating per-scope variants of the same key.
 */
export const PERMISSION_MODULES: Record<string, { key: string; label: string }[]> = {
  Staff: [
    { key: 'staff.view',    label: 'View Staff Directory' },
    { key: 'staff.create',  label: 'Add Staff'            },
    { key: 'staff.update',  label: 'Edit Staff'           },
    { key: 'staff.archive', label: 'Archive Staff'        },
  ],
  Attendance: [
    { key: 'attendance.view',   label: 'View Attendance'   },
    { key: 'attendance.manage', label: 'Manage Attendance' },
    { key: 'attendance.import', label: 'Import Attendance' },
  ],
  Leave: [
    { key: 'leave.view',    label: 'View Leave'          },
    { key: 'leave.request', label: 'Submit Leave Request' },
    { key: 'leave.approve', label: 'Approve Leave'        },
  ],
  Documents: [
    { key: 'documents.view',   label: 'View Documents'   },
    { key: 'documents.upload', label: 'Upload Documents' },
    { key: 'documents.delete', label: 'Delete Documents' },
  ],
  Announcements: [
    { key: 'announcements.view',   label: 'View Announcements'              },
    { key: 'announcements.create', label: 'Create Announcements'            },
    { key: 'announcements.manage', label: 'Manage All Announcements (Admin)' },
  ],
  Reports: [
    { key: 'reports.view',   label: 'View Reports'   },
    { key: 'reports.export', label: 'Export Reports' },
  ],
  'Audit Logs': [
    { key: 'audit_logs.view', label: 'View Audit Logs' },
  ],
  Organization: [
    { key: 'organization.view',   label: 'View Org Settings'   },
    { key: 'organization.update', label: 'Update Org Settings' },
  ],
  Departments: [
    { key: 'departments.view',    label: 'View Departments'    },
    { key: 'departments.create',  label: 'Create Departments'  },
    { key: 'departments.update',  label: 'Edit Departments'    },
    { key: 'departments.archive', label: 'Archive Departments' },
  ],
  Teams: [
    { key: 'teams.view',    label: 'View Teams'    },
    { key: 'teams.create',  label: 'Create Teams'  },
    { key: 'teams.update',  label: 'Edit Teams'    },
    { key: 'teams.archive', label: 'Archive Teams' },
  ],
  Roles: [
    { key: 'roles.view',   label: 'View Roles'   },
    { key: 'roles.create', label: 'Create Roles' },
    { key: 'roles.update', label: 'Edit Roles'   },
    { key: 'roles.delete', label: 'Delete Roles' },
  ],
  Settings: [
    { key: 'settings.view',   label: 'View Settings'   },
    { key: 'settings.update', label: 'Update Settings' },
  ],
};

/**
 * Frozen system role definitions.
 *
 * Key design decisions:
 * - `leave.request` is a separate permission from `leave.approve` — every role that
 *   needs to submit their own leave gets it; self-approval prevention is a business rule.
 * - `announcements.manage` (edit/archive all org announcements) is Admin-only.
 * - HR Manager does NOT get audit_logs, organization management, or settings.
 * - Manager operates within team/department scope (enforced at data layer, not here).
 * - Staff gets a limited directory + self-service; RLS further scopes the rows.
 */
export const SYSTEM_ROLES = [
  {
    name: 'Organization Admin',
    color: 'rose' as const,
    emoji: '🔴',
    description: 'Full organization control. Scope: entire organization.',
    isSystem: true,
    permissionKeys: Object.values(PERMISSION_MODULES).flatMap((perms) => perms.map((p) => p.key)),
  },
  {
    name: 'HR Manager',
    color: 'orange' as const,
    emoji: '🟠',
    description: 'HR operations across the entire organization.',
    isSystem: true,
    permissionKeys: [
      'staff.view', 'staff.create', 'staff.update', 'staff.archive',
      'attendance.view', 'attendance.manage', 'attendance.import',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'documents.upload', 'documents.delete',
      'announcements.view', 'announcements.create',
      'reports.view', 'reports.export',
    ],
  },
  {
    name: 'Manager',
    color: 'yellow' as const,
    emoji: '🟡',
    description: 'Team/department oversight. Scope: assigned direct reports.',
    isSystem: true,
    permissionKeys: [
      'staff.view',
      'attendance.view', 'attendance.manage',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view',
      'announcements.view',
      'reports.view',
    ],
  },
  {
    name: 'Staff',
    color: 'green' as const,
    emoji: '🟢',
    description: 'Self-service access only. Scope: own records + limited directory.',
    isSystem: true,
    permissionKeys: [
      'staff.view',
      'attendance.view',
      'leave.view', 'leave.request',
      'documents.view',
      'announcements.view',
    ],
  },
];

// ── Navigation access matrix (informational) ────────────────────────────────
const NAV_MATRIX = [
  { nav: 'Dashboard',     admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'Staff',         admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'Attendance',    admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'Leave',         admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'Announcements', admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'Documents',     admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'Reports',       admin: true,  hr: true,  manager: true,  staff: false },
  { nav: 'Audit Logs',    admin: true,  hr: false, manager: false, staff: false },
  { nav: 'Settings',      admin: true,  hr: false, manager: false, staff: false },
  { nav: 'Notifications', admin: true,  hr: true,  manager: true,  staff: true  },
  { nav: 'My Profile',    admin: true,  hr: true,  manager: true,  staff: true  },
];

const Tick = ({ yes }: { yes: boolean }) =>
  yes
    ? <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
    : <XCircle size={14} className="text-slate-200 mx-auto" />;

const RoleCard: React.FC<{ role: typeof SYSTEM_ROLES[0] }> = ({ role }) => {
  const [expanded, setExpanded] = useState(false);
  const allKeys = Object.values(PERMISSION_MODULES).flatMap((p) => p.map((x) => x.key));

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">{role.emoji}</span>
            <div>
              <CardTitle className="text-sm">{role.name}</CardTitle>
              <CardDescription className="text-[11px]">{role.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
            <Badge variant="outline" className="text-[10px]">{role.permissionKeys.length}/{allKeys.length} perms</Badge>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 border-t border-slate-100">
          <div className="mt-3 space-y-4">
            {Object.entries(PERMISSION_MODULES).map(([module, perms]) => (
              <div key={module}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{module}</div>
                <div className="grid grid-cols-2 gap-1">
                  {perms.map((perm) => {
                    const active = role.permissionKeys.includes(perm.key);
                    return (
                      <div
                        key={perm.key}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] border ${
                          active
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-50 border-slate-100 text-slate-300'
                        }`}
                      >
                        {active
                          ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                          : <XCircle size={11} className="text-slate-200 shrink-0" />}
                        <span className="font-mono text-[10px] truncate">{perm.key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const RolesPermissionsPage: React.FC = () => {
  const { activeOrganization, activePermissions } = useTenant();
  const [activeTab, setActiveTab] = useState<'roles' | 'matrix' | 'mine'>('roles');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] font-mono">Settings → Roles</Badge>
              <span className="text-xs text-slate-400">· {activeOrganization?.name}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Roles & Permissions</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-lg">
              System role definitions and their permission keys. Authorization evaluates both the permission key <em>and</em> data scope. PostgreSQL RLS is the final enforcement layer.
            </p>
          </div>
          <PermissionGuard permission="roles.create">
            <Button size="sm" variant="outline">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Create Custom Role
            </Button>
          </PermissionGuard>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['roles', 'matrix', 'mine'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab === 'roles' ? 'System Roles' : tab === 'matrix' ? 'Nav Access Matrix' : 'My Permissions'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: System Roles ─────────────────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400 font-medium">Click a role's expand button to inspect its full permission set.</p>
          {SYSTEM_ROLES.map((role) => (
            <RoleCard key={role.name} role={role} />
          ))}
        </div>
      )}

      {/* ── Tab: Navigation Access Matrix ────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <Card className="border-slate-200 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Navigation Visibility by Role</CardTitle>
            <CardDescription className="text-xs">
              Visibility controls <strong>which pages appear in navigation</strong>. It does not imply unrestricted data access — scope is enforced at the data layer.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600 w-40">Navigation</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-rose-600">🔴 Admin</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-orange-500">🟠 HR Mgr</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-yellow-600">🟡 Manager</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-emerald-600">🟢 Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {NAV_MATRIX.map((row, i) => (
                    <tr key={row.nav} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="px-4 py-2.5 font-semibold text-slate-700">{row.nav}</td>
                      <td className="px-3 py-2.5 text-center"><Tick yes={row.admin} /></td>
                      <td className="px-3 py-2.5 text-center"><Tick yes={row.hr} /></td>
                      <td className="px-3 py-2.5 text-center"><Tick yes={row.manager} /></td>
                      <td className="px-3 py-2.5 text-center"><Tick yes={row.staff} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab: My Permissions ───────────────────────────────────────────── */}
      {activeTab === 'mine' && (
        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> Your Active Permissions
            </CardTitle>
            <CardDescription className="text-xs">
              Resolved permission set for your current session in <strong>{activeOrganization?.name}</strong>.{' '}
              <span className="text-indigo-600 font-medium">{activePermissions.length} permissions active.</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {activePermissions.length > 0 ? activePermissions.map((perm) => (
                <Badge key={perm} variant="secondary" className="text-[10px] font-mono bg-indigo-100 text-indigo-800 border-indigo-200">
                  {perm}
                </Badge>
              )) : (
                <p className="text-xs text-slate-400">No permissions loaded. Check your organization membership.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
