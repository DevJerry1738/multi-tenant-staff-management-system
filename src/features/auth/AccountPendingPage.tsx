import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTenant } from '@/lib/tenant/TenantContext';
import { UserCheck, LogOut, Mail, RefreshCw } from 'lucide-react';

/**
 * AccountPendingPage — /account/pending
 *
 * Shown when a user is authenticated but has no organization membership.
 * This happens when:
 *   - An account exists in auth.users but no organization_members row was created.
 *   - The invitation token was generated but not yet accepted.
 *   - An admin created the account but hasn't assigned an organization.
 */
export const AccountPendingPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { membershipStatus, isPlatformAdmin } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (membershipStatus === 'active') {
      navigate(isPlatformAdmin ? '/organizations' : '/dashboard', { replace: true });
    }
  }, [membershipStatus, isPlatformAdmin, navigate]);

  if (membershipStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-xl shadow-indigo-900/50 animate-pulse">
            MT
          </div>
          <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          <span className="text-xs font-semibold text-indigo-300/70 tracking-wide">Resolving organization...</span>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleRefresh = () => {
    // Reload the page to re-trigger membership resolution
    window.location.replace('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl mx-auto shadow-xl shadow-indigo-900/50">
          MT
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />

          <div className="px-8 py-8 space-y-5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto">
              <UserCheck size={28} className="text-amber-600" />
            </div>

            {/* Heading */}
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Account Setup Required</h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Your account has been created, but it has not yet been assigned to an organization.
              </p>
            </div>

            {/* Signed in as */}
            {user?.email && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-4 py-2.5">
                <Mail size={13} className="text-slate-400 shrink-0" />
                <span>Signed in as <strong className="text-slate-700">{user.email}</strong></span>
              </div>
            )}

            {/* Instructions */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-left space-y-2">
              <div className="text-xs font-bold text-amber-800">What to do next:</div>
              <ul className="text-xs text-amber-700 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold mt-0.5">1.</span>
                  Check your inbox for an invitation email from your organization.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold mt-0.5">2.</span>
                  Click the invitation link to complete your account setup.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold mt-0.5">3.</span>
                  If you haven't received an invitation, contact your organization administrator.
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={handleRefresh}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                <RefreshCw size={14} />
                Check Again
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-indigo-300/50">
          Multi-Tenant Staff Management Platform · Secure Portal Access
        </p>
      </div>
    </div>
  );
};
