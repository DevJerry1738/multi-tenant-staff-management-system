import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/TenantContext';
import { attendanceService } from '@/lib/attendance/attendanceService';
import type { OrganizationSettings } from '@/types/database';
import { Clock, Calendar, Edit3, UploadCloud, BarChart3, Settings } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { AttendanceSettingsModal } from './AttendanceSettingsModal';

interface AttendanceLayoutProps {
  children: React.ReactNode;
}

export const AttendanceLayout: React.FC<AttendanceLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { activeOrganization, activeRoles } = useTenant();
  const orgId = activeOrganization?.id || '';

  const [settings, setSettings] = useState<Partial<OrganizationSettings>>({});
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const isAdminOrHR = activeRoles.some(
    (r) => r.name === 'Organization Admin' || r.name === 'HR Manager'
  );
  const isManager = activeRoles.some((r) => r.name === 'Manager');

  const loadSettings = async () => {
    if (!orgId) return;
    const s = await attendanceService.getAttendanceSettings(orgId);
    setSettings(s);
  };

  useEffect(() => {
    loadSettings();
  }, [orgId]);

  const method = settings.attendance_method || 'platform_clocking';

  return (
    <div className="space-y-6">
      {/* Module Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] font-mono">Sprint 3 · Attendance</Badge>
              <span className="text-xs text-slate-400">• {activeOrganization?.name}</span>

              {/* Attendance Collection Method Badge */}
              {method === 'platform_clocking' ? (
                <Badge variant="success" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  Platform Clocking Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                  Biometric File Import Active
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">Attendance Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Timekeeping, platform clocking, biometric file imports, manual corrections, and analytics. Enforced by PostgreSQL RLS.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PermissionGuard permission="settings.view">
              <Button size="sm" variant="outline" onClick={() => setSettingsModalOpen(true)}>
                <Settings className="w-4 h-4 mr-1.5" /> Collection Settings
              </Button>
            </PermissionGuard>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-b border-slate-100 pb-2">
          {/* Today's Attendance */}
          <NavLink
            to="/attendance"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Clock size={14} /> {isAdminOrHR || isManager ? "Today's Attendance" : 'My Attendance'}
          </NavLink>

          {/* History */}
          <NavLink
            to="/attendance/history"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Calendar size={14} /> Attendance History
          </NavLink>

          {/* Manual Corrections (Admin / HR / Manager) */}
          {(isAdminOrHR || isManager) && (
            <NavLink
              to="/attendance/corrections"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Edit3 size={14} /> Corrections
            </NavLink>
          )}

          {/* Biometric Import (Admin / HR) */}
          {isAdminOrHR && (
            <NavLink
              to="/attendance/import"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <UploadCloud size={14} /> Biometric Import
            </NavLink>
          )}

          {/* Reports (Admin / HR / Manager) */}
          {(isAdminOrHR || isManager) && (
            <NavLink
              to="/attendance/reports"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <BarChart3 size={14} /> Reports & Analytics
            </NavLink>
          )}
        </div>
      </div>

      {/* Feature Workspace */}
      <div>{children}</div>

      {/* Settings Modal */}
      <AttendanceSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSuccess={loadSettings}
        currentSettings={settings}
        orgId={orgId}
      />
    </div>
  );
};
