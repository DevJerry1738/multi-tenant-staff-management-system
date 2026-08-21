import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Organization, Role, StaffProfile } from '@/types/database';
import { MOCK_ORGANIZATIONS, MOCK_ROLES, MOCK_PERMISSIONS, MOCK_STAFF } from './mockData';
import { useAuth } from '@/lib/auth/AuthContext';
import { MOCK_INVITATIONS } from '@/lib/organizations/organizationService';

interface TenantContextType {
  activeOrganization: Organization | null;
  activeRoles: Role[];
  activePermissions: string[];
  currentStaffProfile: StaffProfile | null;
  isPlatformAdmin: boolean;
  userOrganizations: Organization[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  hasPermission: (permissionKey: string) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [activeRoles, setActiveRoles] = useState<Role[]>([]);
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [currentStaffProfile, setCurrentStaffProfile] = useState<StaffProfile | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (!user) {
      setActiveOrganization(null);
      setActiveRoles([]);
      setActivePermissions([]);
      setCurrentStaffProfile(null);
      setUserOrganizations([]);
      setIsPlatformAdmin(false);
      setIsLoading(false);
      return;
    }

    const email = user.email.toLowerCase();

    // Check Platform Admin status (e.g. platform operator credentials)
    const platformAdmin = email === 'admin@demorealty.com' || email.includes('platform');
    setIsPlatformAdmin(platformAdmin);

    // Resolve Organization Membership
    let targetOrg: Organization = MOCK_ORGANIZATIONS[0];

    // Check if user accepted a dynamic organization invitation
    const inv = MOCK_INVITATIONS.find((i) => i.email.toLowerCase() === email);
    if (inv) {
      const createdOrg = MOCK_ORGANIZATIONS.find((o) => o.id === inv.organization_id);
      if (createdOrg) targetOrg = createdOrg;
    } else if (email.includes('demorealtyb') || email.includes('bob')) {
      targetOrg = MOCK_ORGANIZATIONS[1]; // Org B
    }

    // Set active organization & roles
    setActiveOrganization(targetOrg);
    setUserOrganizations(MOCK_ORGANIZATIONS);

    const roles = MOCK_ROLES[targetOrg.id] || [];
    setActiveRoles(roles);

    const perms = MOCK_PERMISSIONS[targetOrg.id] || [];
    setActivePermissions(perms);

    // Find linked staff profile
    const orgStaff = MOCK_STAFF[targetOrg.id] || [];
    const staff = orgStaff.find((s) => s.email.toLowerCase() === email) || orgStaff[0] || null;
    setCurrentStaffProfile(staff);

    setIsLoading(false);
  }, [user]);

  const switchOrganization = (orgId: string) => {
    const target = MOCK_ORGANIZATIONS.find((o) => o.id === orgId);
    if (!target) return;

    setActiveOrganization(target);
    setActiveRoles(MOCK_ROLES[orgId] || []);
    setActivePermissions(MOCK_PERMISSIONS[orgId] || []);

    const orgStaff = MOCK_STAFF[orgId] || [];
    const staff = orgStaff.find((s) => s.email.toLowerCase() === (user?.email || '').toLowerCase()) || orgStaff[0] || null;
    setCurrentStaffProfile(staff);
  };

  const hasPermission = (permissionKey: string): boolean => {
    return activePermissions.includes(permissionKey);
  };

  return (
    <TenantContext.Provider
      value={{
        activeOrganization,
        activeRoles,
        activePermissions,
        currentStaffProfile,
        isPlatformAdmin,
        userOrganizations,
        isLoading,
        switchOrganization,
        hasPermission,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
