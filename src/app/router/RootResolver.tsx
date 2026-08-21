import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTenant } from '@/lib/tenant/TenantContext';

/**
 * RootResolver — mounted at "/"
 *
 * Reads authentication and membership state and redirects to the
 * correct destination. Nothing renders here; this is a pure router gate.
 *
 * Decision tree:
 *   Auth loading            → fullscreen spinner (wait)
 *   Not authenticated       → /login
 *   Tenant loading          → fullscreen spinner (wait)
 *   isPlatformAdmin         → /organizations
 *   membershipStatus=deactivated → /account/deactivated
 *   membershipStatus=no_membership → /account/pending
 *   membershipStatus=active → /dashboard
 */
export const RootResolver: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isPlatformAdmin, membershipStatus, isLoading: tenantLoading } = useTenant();

  // ── Auth check in flight ─────────────────────────────────────────────────
  if (authLoading) {
    return <AppGatewaySpinner label="Checking authentication…" />;
  }

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ── Tenant resolution in flight ──────────────────────────────────────────
  if (tenantLoading || membershipStatus === 'loading') {
    return <AppGatewaySpinner label="Resolving organization…" />;
  }

  // ── Platform Admin → Organization Console ───────────────────────────────
  if (isPlatformAdmin) {
    return <Navigate to="/organizations" replace />;
  }

  // ── Deactivated account ──────────────────────────────────────────────────
  if (membershipStatus === 'deactivated') {
    return <Navigate to="/account/deactivated" replace />;
  }

  // ── No organization membership found ────────────────────────────────────
  if (membershipStatus === 'no_membership') {
    return <Navigate to="/account/pending" replace />;
  }

  // ── Active org user → Dashboard ─────────────────────────────────────────
  return <Navigate to="/dashboard" replace />;
};

// ── Shared fullscreen spinner ─────────────────────────────────────────────
const AppGatewaySpinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      {/* Logo mark */}
      <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-900/50 animate-pulse">
        <span className="text-white font-extrabold text-lg">MT</span>
      </div>

      {/* Spinner ring */}
      <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />

      {/* Label */}
      <span className="text-xs font-semibold text-indigo-300/70 tracking-wide">{label}</span>
    </div>
  </div>
);
