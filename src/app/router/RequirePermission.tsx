import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/TenantContext';

interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
}

/**
 * Route-level permission guard.
 * Redirects to /unauthorized if the user lacks the required permission.
 *
 * Usage in router:
 *   <Route path="/audit" element={
 *     <RequirePermission permission="audit_logs.view">
 *       <AuditPage />
 *     </RequirePermission>
 *   } />
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  children,
}) => {
  const { hasPermission, isLoading } = useTenant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-xs text-slate-500 font-medium">
        Verifying permissions…
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
