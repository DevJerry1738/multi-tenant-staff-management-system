import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTenant } from '@/lib/tenant/TenantContext';
import { AppShell } from '@/app/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { UnauthorizedPage } from '@/features/auth/UnauthorizedPage';
import { AcceptInvitationPage } from '@/features/onboarding/AcceptInvitationPage';
import { OrganizationListPage } from '@/features/onboarding/OrganizationListPage';
import { OrganizationSetupWizard } from '@/features/onboarding/OrganizationSetupWizard';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { RolesPermissionsPage } from '@/features/roles/RolesPermissionsPage';
import { StaffDirectoryPage } from '@/features/staff/StaffDirectoryPage';
import { StaffDetailPage } from '@/features/staff/StaffDetailPage';
import { DepartmentsPage } from '@/features/staff/DepartmentsPage';
import { TeamsPage } from '@/features/staff/TeamsPage';
import { TodayAttendancePage } from '@/features/attendance/TodayAttendancePage';
import { AttendanceHistoryPage } from '@/features/attendance/AttendanceHistoryPage';
import { BiometricImportPage } from '@/features/attendance/BiometricImportPage';
import { AttendanceReportsPage } from '@/features/attendance/AttendanceReportsPage';
import { PlaceholderModule } from '@/components/common/PlaceholderModule';
import { RequirePermission } from './RequirePermission';

// ── Auth guard ──────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 animate-pulse" />
          <span className="text-xs font-semibold text-slate-500">Authenticating session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
};

// ── Platform Admin guard ─────────────────────────────────────────────────────
const RequirePlatformAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPlatformAdmin } = useTenant();
  if (!isPlatformAdmin) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
};

// ── Router ──────────────────────────────────────────────────────────────────
export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* ── Public routes ──────────────────────────────────────────────────── */}
      <Route path="/login"              element={<LoginPage />} />
      <Route path="/forgot-password"    element={<ForgotPasswordPage />} />
      <Route path="/reset-password"     element={<ResetPasswordPage />} />
      <Route path="/accept-invitation"  element={<AcceptInvitationPage />} />

      {/* ── Platform Admin — organization provisioning ─────────────────────── */}
      <Route path="/organizations" element={
        <ProtectedRoute>
          <RequirePlatformAdmin>
            <OrganizationListPage />
          </RequirePlatformAdmin>
        </ProtectedRoute>
      } />

      <Route path="/organizations/new" element={
        <ProtectedRoute>
          <RequirePlatformAdmin>
            <OrganizationSetupWizard />
          </RequirePlatformAdmin>
        </ProtectedRoute>
      } />

      <Route path="/organizations/:orgId/setup" element={
        <ProtectedRoute>
          <RequirePlatformAdmin>
            <OrganizationSetupWizard />
          </RequirePlatformAdmin>
        </ProtectedRoute>
      } />

      {/* ── Dashboard — all authenticated roles ────────────────────────────── */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />

      {/* ── Sprint 2: Staff Management ──────────────────────────────────────── */}
      <Route path="/staff" element={
        <ProtectedRoute><StaffDirectoryPage /></ProtectedRoute>
      } />
      <Route path="/staff/:staffId" element={
        <ProtectedRoute><StaffDetailPage /></ProtectedRoute>
      } />
      <Route path="/staff/departments" element={
        <ProtectedRoute><DepartmentsPage /></ProtectedRoute>
      } />
      <Route path="/staff/teams" element={
        <ProtectedRoute><TeamsPage /></ProtectedRoute>
      } />

      {/* ── Sprint 3: Attendance Management ────────────────────────────────── */}
      <Route path="/attendance" element={
        <ProtectedRoute>
          <RequirePermission permission="attendance.view">
            <TodayAttendancePage />
          </RequirePermission>
        </ProtectedRoute>
      } />
      <Route path="/attendance/history" element={
        <ProtectedRoute>
          <RequirePermission permission="attendance.view">
            <AttendanceHistoryPage />
          </RequirePermission>
        </ProtectedRoute>
      } />
      <Route path="/attendance/corrections" element={
        <ProtectedRoute>
          <RequirePermission permission="attendance.manage">
            <AttendanceHistoryPage />
          </RequirePermission>
        </ProtectedRoute>
      } />
      <Route path="/attendance/import" element={
        <ProtectedRoute>
          <RequirePermission permission="attendance.import">
            <BiometricImportPage />
          </RequirePermission>
        </ProtectedRoute>
      } />
      <Route path="/attendance/reports" element={
        <ProtectedRoute>
          <RequirePermission permission="attendance.view">
            <AttendanceReportsPage />
          </RequirePermission>
        </ProtectedRoute>
      } />

      {/* ── Leave ──────────────────────────────────────────────────────────── */}
      <Route path="/leave" element={
        <ProtectedRoute>
          <PlaceholderModule title="Leave Management" description="Leave Types, Balances, Requests & Approvals." sprintTarget="Sprint 4" tablesPrepared={['leave_types', 'leave_balances', 'leave_requests']} />
        </ProtectedRoute>
      } />

      {/* ── Announcements ──────────────────────────────────────────────────── */}
      <Route path="/announcements" element={
        <ProtectedRoute>
          <PlaceholderModule title="Announcements" description="Announcements & Target Audiences." sprintTarget="Sprint 5" tablesPrepared={['announcements', 'announcement_targets']} />
        </ProtectedRoute>
      } />

      {/* ── Documents ──────────────────────────────────────────────────────── */}
      <Route path="/documents" element={
        <ProtectedRoute>
          <PlaceholderModule title="Staff Documents" description="HR Documents & Storage." sprintTarget="Sprint 6" tablesPrepared={['document_categories', 'staff_documents']} />
        </ProtectedRoute>
      } />

      {/* ── Reports ─────────────────────────────────────────────────────────── */}
      <Route path="/reports" element={
        <ProtectedRoute>
          <RequirePermission permission="reports.view">
            <PlaceholderModule title="Reports & Analytics" description="Organization Analytics." sprintTarget="Sprint 7" tablesPrepared={['audit_logs']} />
          </RequirePermission>
        </ProtectedRoute>
      } />

      {/* ── Audit Logs ──────────────────────────────────────────────────────── */}
      <Route path="/audit" element={
        <ProtectedRoute>
          <RequirePermission permission="audit_logs.view">
            <PlaceholderModule title="Audit Logs" description="Security & Audit Trail Events." sprintTarget="Sprint 8" tablesPrepared={['audit_logs']} />
          </RequirePermission>
        </ProtectedRoute>
      } />

      {/* ── Settings ─────────────────────────────────────────────────────────── */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <RequirePermission permission="settings.view">
            <PlaceholderModule title="Organization Settings" description="General · Departments · Teams · Roles & Permissions · Attendance · Leave" sprintTarget="Sprint 1+" tablesPrepared={['organizations', 'organization_settings', 'roles']} />
          </RequirePermission>
        </ProtectedRoute>
      } />

      <Route path="/settings/roles" element={
        <ProtectedRoute>
          <RequirePermission permission="roles.view">
            <RolesPermissionsPage />
          </RequirePermission>
        </ProtectedRoute>
      } />

      {/* ── Notifications ───────────────────────────────────────────────────── */}
      <Route path="/notifications" element={
        <ProtectedRoute>
          <PlaceholderModule title="Notifications" description="In-App Notifications, Deliveries & Preferences." sprintTarget="Sprint 5" tablesPrepared={['notifications']} />
        </ProtectedRoute>
      } />

      {/* ── My Profile ──────────────────────────────────────────────────────── */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <PlaceholderModule title="My Profile" description="Personal profile view and account settings." sprintTarget="Sprint 2" tablesPrepared={['staff_profiles', 'organization_members']} />
        </ProtectedRoute>
      } />

      {/* ── Unauthorized ────────────────────────────────────────────────────── */}
      <Route path="/unauthorized" element={
        <ProtectedRoute><UnauthorizedPage /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
