import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/TenantContext';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Megaphone,
  FileText,
  BarChart3,
  ShieldAlert,
  Settings,
  Building2,
  LogOut,
  Menu,
  X,
  Bell,
  UserCircle,
  ChevronDown,
  HelpCircle,
  Landmark,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';

interface NavItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  /** Permission key required to see this item. Omit = visible to all authenticated users. */
  permission?: string;
}

/**
 * Primary sidebar navigation.
 *
 * Visibility rules (per spec §2 / §14):
 *   Dashboard     — all roles
 *   Staff         — all roles (scope enforced at data layer)
 *   Attendance    — all roles (scope enforced at data layer)
 *   Leave         — all roles (scope enforced at data layer)
 *   Announcements — all roles (scope enforced at data layer)
 *   Documents     — all roles (scope enforced at data layer)
 *   Reports       — Admin, HR Manager, Manager  (requires reports.view)
 *   Audit Logs    — Admin only                  (requires audit_logs.view)
 *   Settings      — Admin only                  (requires settings.view)
 *
 * Global/header items (Notifications, My Profile, Help) are rendered in the
 * header bar, not in the sidebar navigation list.
 */
const SIDEBAR_NAV: NavItem[] = [
  { label: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
  { label: 'Staff',         path: '/staff',         icon: Users            },
  { label: 'Attendance',    path: '/attendance',    icon: Clock            },
  { label: 'Leave',         path: '/leave',         icon: CalendarDays     },
  { label: 'Announcements', path: '/announcements', icon: Megaphone        },
  { label: 'Documents',     path: '/documents',     icon: FileText         },
  { label: 'Reports',       path: '/reports',       icon: BarChart3,       permission: 'reports.view'    },
  { label: 'Audit Logs',    path: '/audit',         icon: ShieldAlert,     permission: 'audit_logs.view' },
  { label: 'Settings',      path: '/settings',      icon: Settings,        permission: 'settings.view'   },
];

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { activeOrganization, activeRoles, hasPermission, isPlatformAdmin } = useTenant();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login');
  };

  const visibleNav = isPlatformAdmin
    ? []
    : SIDEBAR_NAV.filter((item) => !item.permission || hasPermission(item.permission));

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 lg:px-6">
        {/* Left: hamburger + wordmark */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-md hover:bg-slate-100 text-slate-600"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm">
              MT
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-none">Staff Management Platform</h1>
              <span className="text-[10px] text-slate-400 font-medium">{activeOrganization?.name || 'Organization Portal'}</span>
            </div>
          </div>
        </div>

        {/* Right: global header actions */}
        <div className="flex items-center gap-1">
          {/* Help / Support – architecture placeholder */}
          <button
            title="Help & Support"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <HelpCircle size={18} />
          </button>

          {/* Notifications – global, all roles */}
          <button
            onClick={() => navigate('/notifications')}
            title="Notifications"
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Bell size={18} />
            {/* Unread dot */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white" />
          </button>

          {/* My Profile – dropdown, all roles */}
          <div className="relative ml-1">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-none">{displayName}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">{user?.email}</div>
              </div>
              <ChevronDown size={14} className={`hidden sm:block text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-800">{displayName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {activeRoles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-[9px] py-0 px-1">{r.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <UserCircle size={14} className="text-slate-400" /> My Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex pt-16 min-h-screen">
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-20 w-60 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3 space-y-3 overflow-y-auto">
            {!isPlatformAdmin && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Organization</div>
                    <div className="text-xs font-bold text-slate-900 truncate">{activeOrganization?.name}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {activeRoles.map((role) => (
                    <Badge key={role.id} variant="secondary" className="text-[9px] py-0 px-1.5">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Permission-filtered Navigation */}
            <nav className="space-y-0.5">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Platform Admin Section */}
            {isPlatformAdmin && (
              <div className="pt-2 mt-2 border-t border-slate-100">
                <div className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Platform Admin</div>
                <NavLink
                  to="/organizations"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-white font-semibold shadow-sm'
                        : 'text-amber-700 hover:bg-amber-50 hover:text-amber-900'
                    }`
                  }
                >
                  <Landmark className="w-4 h-4 shrink-0" />
                  <span>Organizations</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
            <button
              onClick={handleLogout}
              className="sm:hidden w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>Sign Out</span>
            </button>
            <div className="text-[10px] text-slate-400 font-mono">
              RLS Enforced · RBAC Active · Sprint 1.5
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden min-w-0">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
