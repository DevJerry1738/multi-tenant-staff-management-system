import React from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children only if the active user has the required permission.
 * Falls back to optional fallback node or null.
 *
 * Usage:
 *   <PermissionGuard permission="staff.create">
 *     <Button>Add Staff</Button>
 *   </PermissionGuard>
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { hasPermission } = useTenant();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};
