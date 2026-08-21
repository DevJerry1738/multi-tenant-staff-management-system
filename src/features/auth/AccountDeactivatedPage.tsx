import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { ShieldOff, LogOut, Mail } from 'lucide-react';

/**
 * AccountDeactivatedPage — /account/deactivated
 *
 * Shown when a user is authenticated but their organization membership
 * has been deactivated or suspended by an administrator.
 */
export const AccountDeactivatedPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center text-slate-300 font-extrabold text-xl mx-auto shadow-xl shadow-black/40">
          MT
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-rose-600 to-red-600" />

          <div className="px-8 py-8 space-y-5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto">
              <ShieldOff size={28} className="text-rose-600" />
            </div>

            {/* Heading */}
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Portal Access Deactivated</h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Your staff portal access has been deactivated by your organization administrator.
              </p>
            </div>

            {/* Signed in as */}
            {user?.email && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-4 py-2.5">
                <Mail size={13} className="text-slate-400 shrink-0" />
                <span>Signed in as <strong className="text-slate-700">{user.email}</strong></span>
              </div>
            )}

            {/* What to do */}
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-left space-y-2">
              <div className="text-xs font-bold text-rose-800">Need to restore access?</div>
              <p className="text-xs text-rose-700 leading-relaxed">
                Please contact your organization administrator to request that your account be reactivated.
                Your attendance history, staff records, and profile data are preserved.
              </p>
            </div>

            {/* Status note */}
            <div className="flex items-center justify-center">
              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">
                Account Status: Deactivated
              </span>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500/50">
          Multi-Tenant Staff Management Platform · Secure Portal Access
        </p>
      </div>
    </div>
  );
};
