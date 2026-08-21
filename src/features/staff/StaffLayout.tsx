import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/TenantContext';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Users, Building2, Layers, Plus } from 'lucide-react';
import { Button, Badge } from '@/components/ui';

interface StaffLayoutProps {
  children: React.ReactNode;
  onAddStaffClick?: () => void;
  onAddDepartmentClick?: () => void;
  onAddTeamClick?: () => void;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  children,
  onAddStaffClick,
  onAddDepartmentClick,
  onAddTeamClick,
}) => {
  const location = useLocation();
  const { activeOrganization, activeRoles } = useTenant();

  const isDirectory = location.pathname === '/staff' || location.pathname.startsWith('/staff/profile');
  const isDepartments = location.pathname === '/staff/departments';
  const isTeams = location.pathname === '/staff/teams';

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] font-mono">Sprint 2 · Staff Management</Badge>
              <span className="text-xs text-slate-400">• {activeOrganization?.name}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Staff Administration</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organization-scoped staff directory, profiles, departments, and teams. Access controlled by permissions and scope.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDirectory && onAddStaffClick && (
              <PermissionGuard permission="staff.create">
                <Button size="sm" onClick={onAddStaffClick} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Staff Member
                </Button>
              </PermissionGuard>
            )}

            {isDepartments && onAddDepartmentClick && (
              <PermissionGuard permission="departments.create">
                <Button size="sm" onClick={onAddDepartmentClick} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Department
                </Button>
              </PermissionGuard>
            )}

            {isTeams && onAddTeamClick && (
              <PermissionGuard permission="teams.create">
                <Button size="sm" onClick={onAddTeamClick} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Team
                </Button>
              </PermissionGuard>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-100 pb-2">
          <NavLink
            to="/staff"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Users size={14} /> Directory
          </NavLink>

          <NavLink
            to="/staff/departments"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Building2 size={14} /> Departments
          </NavLink>

          <NavLink
            to="/staff/teams"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Layers size={14} /> Teams
          </NavLink>
        </div>
      </div>

      {/* Main Feature Workspace */}
      <div>{children}</div>
    </div>
  );
};
