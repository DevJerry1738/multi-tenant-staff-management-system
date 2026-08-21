import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Organization, Role, StaffProfile } from '@/types/database';
import { MOCK_ORGANIZATIONS, MOCK_ROLES, MOCK_PERMISSIONS, MOCK_STAFF } from './mockData';
import { useAuth } from '@/lib/auth/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { MOCK_INVITATIONS } from '@/lib/organizations/organizationService';

// ── Dev credentials that get mock data ──────────────────────────────────────
const MOCK_ORG_A_EMAILS = new Set([
  'admin@demorealty.com',
  'alice@demorealtya.com',
  'aaron@demorealtya.com',
]);
const MOCK_ORG_B_EMAILS = new Set([
  'bob@demorealtyb.com',
]);
const PLATFORM_ADMIN_EMAILS = new Set([
  'admin@demorealty.com',
]);
const mockAuthEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_AUTH === 'true';

/**
 * Membership status drives the RootResolver redirect:
 *   loading        → spinner
 *   no_membership  → /account/pending
 *   deactivated    → /account/deactivated
 *   active         → /dashboard (or /organizations for platform admin)
 */
export type MembershipStatus = 'loading' | 'no_membership' | 'deactivated' | 'active';

interface TenantContextType {
  activeOrganization: Organization | null;
  activeRoles: Role[];
  activePermissions: string[];
  currentStaffProfile: StaffProfile | null;
  isPlatformAdmin: boolean;
  userOrganizations: Organization[];
  isLoading: boolean;
  membershipStatus: MembershipStatus;
  switchOrganization: (orgId: string) => void;
  hasPermission: (permissionKey: string) => boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [activeOrganization, setActiveOrganization]   = useState<Organization | null>(null);
  const [activeRoles, setActiveRoles]                 = useState<Role[]>([]);
  const [activePermissions, setActivePermissions]     = useState<string[]>([]);
  const [currentStaffProfile, setCurrentStaffProfile] = useState<StaffProfile | null>(null);
  const [userOrganizations, setUserOrganizations]     = useState<Organization[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin]         = useState(false);
  const [isLoading, setIsLoading]                     = useState(true);
  const [membershipStatus, setMembershipStatus]       = useState<MembershipStatus>('loading');

  useEffect(() => {
    // Reset when user changes
    setIsLoading(true);
    setMembershipStatus('loading');

    if (!user) {
      // Not authenticated — clear everything
      setActiveOrganization(null);
      setActiveRoles([]);
      setActivePermissions([]);
      setCurrentStaffProfile(null);
      setUserOrganizations([]);
      setIsPlatformAdmin(false);
      setIsLoading(false);
      setMembershipStatus('no_membership');
      return;
    }

    const email = user.email.toLowerCase();

    const resolve = async () => {
      let isPlatAdmin = false;
      if (isSupabaseConfigured) {
        const { data: platformAdmin } = await supabase
          .from('platform_admins')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        isPlatAdmin = Boolean(platformAdmin);
      } else if (mockAuthEnabled) {
        isPlatAdmin = PLATFORM_ADMIN_EMAILS.has(email);
      }
      setIsPlatformAdmin(isPlatAdmin);

      // ── 1. Try Supabase for real membership ─────────────────────────────
      let resolvedFromSupabase = false;
      try {
        const { data: memberships, error } = await supabase
          .from('organization_members')
          .select(`
            id, organization_id, user_id, status,
            organizations ( id, name, slug, status, setup_completed_at, country, timezone )
          `)
          .eq('user_id', user.id)
          .limit(10);

        if (!error && memberships && memberships.length > 0) {
          resolvedFromSupabase = true;

          // Check for deactivated/suspended membership
          const activeMembership = memberships.find(
            (m: any) => m.status === 'active'
          );
          if (!activeMembership && !isPlatAdmin) {
            setMembershipStatus('deactivated');
            setIsLoading(false);
            return;
          }

          if (activeMembership) {
            const org = (activeMembership as any).organizations as Organization;
            setActiveOrganization(org);
            setUserOrganizations(memberships.map((m: any) => m.organizations as Organization));

            const memberRoleResult = await supabase
              .from('member_roles')
              .select('role_id, roles ( id, organization_id, name, description, is_system_role, created_at, updated_at )')
              .eq('organization_member_id', activeMembership.id);
            const roles = (!memberRoleResult.error ? memberRoleResult.data : [])
              .map((entry: any) => entry.roles)
              .filter(Boolean) as Role[];

            const roleIds = roles.map((role) => role.id);
            let perms: string[] = [];
            if (roleIds.length > 0) {
              const permissionResult = await supabase
                .from('role_permissions')
                .select('permissions ( key )')
                .in('role_id', roleIds);
              perms = (!permissionResult.error ? permissionResult.data : [])
                .map((entry: any) => entry.permissions?.key)
                .filter((key: unknown): key is string => typeof key === 'string');
            }
            setActiveRoles(roles);
            setActivePermissions(perms);

            const { data: staffProfile } = await supabase
              .from('staff_profiles')
              .select('*')
              .eq('organization_member_id', activeMembership.id)
              .maybeSingle();
            setCurrentStaffProfile((staffProfile as StaffProfile | null) ?? null);
          }

          setMembershipStatus('active');
        }
      } catch {
        // Supabase query error — fall through
      }

      // ── 2. No Supabase data: try invitation-based resolution (Sprint 1.5) ─
      if (!resolvedFromSupabase && mockAuthEnabled) {
        const inv = MOCK_INVITATIONS.find(
          (i) => i.email.toLowerCase() === email && i.accepted_at
        );
        if (inv) {
          const createdOrg = MOCK_ORGANIZATIONS.find(o => o.id === inv.organization_id);
          if (createdOrg) {
            setActiveOrganization(createdOrg);
            setUserOrganizations([createdOrg]);
            setActiveRoles(MOCK_ROLES[createdOrg.id] || []);
            setActivePermissions(MOCK_PERMISSIONS[createdOrg.id] || []);
            const orgStaff = MOCK_STAFF[createdOrg.id] || [];
            setCurrentStaffProfile(orgStaff.find(s => s.email.toLowerCase() === email) || null);
            setMembershipStatus('active');
            setIsLoading(false);
            return;
          }
        }
      }

      // ── 3. Known dev mock credentials or Platform Admin ─────────────────
      if (!resolvedFromSupabase && mockAuthEnabled) {
        if (isPlatAdmin) {
          // Platform admin always has active access to the platform console
          const org = MOCK_ORGANIZATIONS[0] || null;
          setActiveOrganization(org);
          setUserOrganizations(MOCK_ORGANIZATIONS);
          setActiveRoles(org ? (MOCK_ROLES[org.id] || []) : []);
          setActivePermissions(org ? (MOCK_PERMISSIONS[org.id] || []) : []);
          const orgStaff = org ? (MOCK_STAFF[org.id] || []) : [];
          setCurrentStaffProfile(orgStaff.find(s => s.email.toLowerCase() === email) || orgStaff[0] || null);
          setMembershipStatus('active');
        } else if (MOCK_ORG_A_EMAILS.has(email)) {
          const org = MOCK_ORGANIZATIONS[0];
          setActiveOrganization(org);
          setUserOrganizations(MOCK_ORGANIZATIONS);
          setActiveRoles(MOCK_ROLES[org.id] || []);
          setActivePermissions(MOCK_PERMISSIONS[org.id] || []);
          const orgStaff = MOCK_STAFF[org.id] || [];
          setCurrentStaffProfile(orgStaff.find(s => s.email.toLowerCase() === email) || orgStaff[0] || null);
          setMembershipStatus('active');
        } else if (MOCK_ORG_B_EMAILS.has(email)) {
          const org = MOCK_ORGANIZATIONS[1];
          setActiveOrganization(org);
          setUserOrganizations(MOCK_ORGANIZATIONS);
          setActiveRoles(MOCK_ROLES[org.id] || []);
          setActivePermissions(MOCK_PERMISSIONS[org.id] || []);
          const orgStaff = MOCK_STAFF[org.id] || [];
          setCurrentStaffProfile(orgStaff.find(s => s.email.toLowerCase() === email) || orgStaff[0] || null);
          setMembershipStatus('active');
        } else {
          // ── 4. Authenticated but no membership found anywhere ─────────────
          setActiveOrganization(null);
          setUserOrganizations([]);
          setActiveRoles([]);
          setActivePermissions([]);
          setCurrentStaffProfile(null);
          setMembershipStatus('no_membership');
        }
      } else if (!resolvedFromSupabase) {
        setActiveOrganization(null);
        setUserOrganizations([]);
        setActiveRoles([]);
        setActivePermissions([]);
        setCurrentStaffProfile(null);
        setMembershipStatus(isPlatAdmin ? 'active' : 'no_membership');
      }

      setIsLoading(false);
    };

    resolve();
  }, [user]);

  // ── Switch organization (for users with multiple memberships) ─────────────
  const switchOrganization = (orgId: string) => {
    const target = MOCK_ORGANIZATIONS.find(o => o.id === orgId)
      ?? userOrganizations.find(o => o.id === orgId);
    if (!target) return;

    setActiveOrganization(target);
    setActiveRoles(MOCK_ROLES[orgId] || []);
    setActivePermissions(MOCK_PERMISSIONS[orgId] || []);

    const email = (user?.email ?? '').toLowerCase();
    const orgStaff = MOCK_STAFF[orgId] || [];
    setCurrentStaffProfile(orgStaff.find(s => s.email.toLowerCase() === email) || orgStaff[0] || null);
  };

  const hasPermission = (permissionKey: string): boolean =>
    activePermissions.includes(permissionKey);

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
        membershipStatus,
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
