import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { MOCK_ORGANIZATIONS, MOCK_ROLES, MOCK_PERMISSIONS } from '@/lib/tenant/mockData';
import type {
  Organization,
  OrganizationSettings,
  Role,
  OrganizationMember,
  OrganizationInvitation,
  AttendanceMethod,
} from '@/types/database';
import { auditService } from '@/lib/audit/auditService';

export interface CreateOrganizationInput {
  name: string;
  legal_name?: string;
  slug: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  country: string;
  timezone: string;
  admin_first_name?: string;
  admin_last_name?: string;
  admin_email?: string;
  attendance_method?: AttendanceMethod;
  default_work_start?: string;
  default_work_end?: string;
}

export interface SetupOrganizationInput {
  timezone: string;
  attendance_method: AttendanceMethod;
  default_work_start: string;
  default_work_end: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
}

export interface UpdateOrganizationInput {
  name: string;
  legal_name?: string;
  slug: string;
  email?: string;
  phone?: string;
  website?: string;
  country: string;
  timezone: string;
  attendance_method: AttendanceMethod;
  default_work_start: string;
  default_work_end: string;
}

// In-memory store for pending invitations
export const MOCK_INVITATIONS: OrganizationInvitation[] = [];

class OrganizationService {
  /**
   * Retrieves all organizations (Platform Admin view).
   */
  async getOrganizations(): Promise<Organization[]> {
    if (!isSupabaseConfigured) {
      return MOCK_ORGANIZATIONS;
    }

    try {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Unable to load organizations.', error);
        return [];
      }
      return data ?? [];
    } catch (error) {
      console.error('Unable to load organizations.', error);
      return [];
    }
  }

  /**
   * Retrieves a single organization by ID.
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    if (!isSupabaseConfigured) {
      return MOCK_ORGANIZATIONS.find((o) => o.id === id) || null;
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('Unable to load organization.', error);
      return null;
    }
    return data as Organization | null;
  }

  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettings | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) {
      console.error('Unable to load organization settings.', error);
      return null;
    }
    return data as OrganizationSettings | null;
  }

  async updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<{ data: Organization | null; error?: string }> {
    if (!isSupabaseConfigured) {
      const organization = MOCK_ORGANIZATIONS.find((item) => item.id === id);
      if (!organization) return { data: null, error: 'Organization not found.' };
      Object.assign(organization, {
        name: input.name,
        slug: input.slug,
        legal_name: input.legal_name || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        country: input.country,
        timezone: input.timezone,
        updated_at: new Date().toISOString(),
      });
      return { data: organization };
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({
        name: input.name,
        slug: input.slug,
        legal_name: input.legal_name || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        country: input.country,
        timezone: input.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message || 'Unable to update organization.' };

    const { error: settingsError } = await supabase
      .from('organization_settings')
      .update({
        attendance_method: input.attendance_method,
        default_work_start: input.default_work_start,
        default_work_end: input.default_work_end,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', id);
    if (settingsError) return { data: null, error: settingsError.message };

    return { data: data as Organization };
  }

  /**
   * Creates a new organization with default system roles and permissions.
   */
  async createOrganization(
    input: CreateOrganizationInput,
    actorUserId?: string
  ): Promise<{ data: Organization | null; error?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('register-organization', { body: input });
      if (error || !data?.organization) {
        return { data: null, error: 'Organization registration is currently unavailable. Please try again later.' };
      }
      return { data: data.organization as Organization };
    }

    const existing = await this.getOrganizations();
    if (existing.some((o) => o.slug.toLowerCase() === input.slug.toLowerCase())) {
      return { data: null, error: `An organization with the identifier "${input.slug}" already exists.` };
    }

    const orgId = `org-${Date.now()}`;
    const newOrg: Organization = {
      id: orgId,
      name: input.name,
      slug: input.slug,
      legal_name: input.legal_name || null,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      logo_url: null,
      industry: 'Real Estate',
      country: input.country,
      timezone: input.timezone,
      status: 'active',
      setup_completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add default roles for this new organization
    const adminRoleId = `role-${orgId}-admin`;
    const hrRoleId = `role-${orgId}-hr`;
    const mgrRoleId = `role-${orgId}-mgr`;
    const staffRoleId = `role-${orgId}-staff`;

    const defaultRoles: Role[] = [
      { id: adminRoleId, organization_id: orgId, name: 'Organization Admin', description: 'Full organization access', is_system_role: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: hrRoleId, organization_id: orgId, name: 'HR Manager', description: 'Staff & HR management', is_system_role: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: mgrRoleId, organization_id: orgId, name: 'Manager', description: 'Team oversight', is_system_role: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: staffRoleId, organization_id: orgId, name: 'Staff', description: 'Standard self-service employee', is_system_role: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    MOCK_ORGANIZATIONS.unshift(newOrg);
    MOCK_ROLES[orgId] = defaultRoles;

    // Full system permissions for Org Admin
    const allPermKeys = [
      'staff.view', 'staff.create', 'staff.update', 'staff.archive',
      'attendance.view', 'attendance.manage', 'attendance.import',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'documents.upload', 'documents.delete',
      'announcements.view', 'announcements.create', 'announcements.manage',
      'reports.view', 'reports.export',
      'audit_logs.view',
      'organization.view', 'organization.update',
      'departments.view', 'departments.create', 'departments.update', 'departments.archive',
      'teams.view', 'teams.create', 'teams.update', 'teams.archive',
      'roles.view', 'roles.create', 'roles.update', 'roles.delete',
      'settings.view', 'settings.update',
    ];
    MOCK_PERMISSIONS[orgId] = allPermKeys;

    await auditService.logEvent({
      organizationId: orgId,
      actorUserId,
      action: 'organization.created',
      resourceType: 'organizations',
      resourceId: orgId,
      newValues: { name: newOrg.name, slug: newOrg.slug, country: newOrg.country },
    });

    return { data: newOrg };
  }

  /**
   * Completes the multi-step organization setup wizard and invites the initial Org Admin.
   */
  async completeOrganizationSetup(
    orgId: string,
    input: SetupOrganizationInput,
    actorUserId?: string
  ): Promise<{ success: boolean; invitation?: OrganizationInvitation; error?: string }> {
    const org = await this.getOrganizationById(orgId);
    if (!org) return { success: false, error: 'Organization not found.' };

    const nowIso = new Date().toISOString();
    org.timezone = input.timezone;
    org.setup_completed_at = nowIso;
    org.updated_at = nowIso;

    // Invite Initial Admin
    const roles = MOCK_ROLES[orgId] || [];
    const adminRole = roles.find((r) => r.name === 'Organization Admin') || roles[0];

    const token = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation: OrganizationInvitation = {
      id: `inv-id-${Date.now()}`,
      organization_id: orgId,
      email: input.admin_email.toLowerCase().trim(),
      role_id: adminRole ? adminRole.id : 'admin-role',
      role_name: 'Organization Admin',
      invited_by: actorUserId || 'platform-admin',
      token,
      expires_at: expiresAt,
      accepted_at: null,
      created_at: nowIso,
    };

    MOCK_INVITATIONS.push(invitation);

    await auditService.logEvent({
      organizationId: orgId,
      actorUserId,
      action: 'organization.setup_completed',
      resourceType: 'organizations',
      resourceId: orgId,
      newValues: {
        setup_completed_at: nowIso,
        admin_email: input.admin_email,
        attendance_method: input.attendance_method,
      },
    });

    await auditService.logEvent({
      organizationId: orgId,
      actorUserId,
      action: 'organization_admin.invited',
      resourceType: 'organization_invitations',
      resourceId: invitation.id,
      newValues: { email: invitation.email, role: invitation.role_name, token },
    });

    return { success: true, invitation };
  }

  /**
   * Fetches an invitation by token from Supabase DB (or mock fallback).
   */
  async getInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
    if (!token) return null;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('organization_invitations')
          .select('*')
          .eq('token_hash', token)
          .is('accepted_at', null)
          .maybeSingle();

        if (!error && data) {
          let roleName = 'Staff';
          if (data.role_id) {
            const { data: roleData } = await supabase
              .from('roles')
              .select('name')
              .eq('id', data.role_id)
              .maybeSingle();
            if (roleData?.name) roleName = roleData.name;
          }

          return {
            id: data.id,
            organization_id: data.organization_id,
            staff_profile_id: data.staff_profile_id,
            email: data.email,
            role_id: data.role_id,
            role_name: roleName,
            invited_by: data.invited_by,
            token: data.token_hash,
            expires_at: data.expires_at,
            accepted_at: data.accepted_at,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.error('Database query for invitation failed:', err);
      }
    }

    // Mock fallback
    const inv = MOCK_INVITATIONS.find((i) => i.token === token && !i.accepted_at);
    return inv || null;
  }

  /**
   * Generates a fully qualified URL for accepting an invitation token.
   */
  getInvitationLink(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://multi-tenant-staff-management-syste.vercel.app';
    return `${origin}/accept-invitation?token=${token}`;
  }

  /**
   * Retrieves the active (unaccepted) invitation token for a specific staff member.
   */
  async getInvitationForStaff(staffProfileId: string, orgId: string): Promise<OrganizationInvitation | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('organization_invitations')
          .select('*')
          .eq('organization_id', orgId)
          .eq('staff_profile_id', staffProfileId)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            organization_id: data.organization_id,
            staff_profile_id: data.staff_profile_id,
            email: data.email,
            role_id: data.role_id,
            role_name: 'Staff',
            invited_by: data.invited_by,
            token: data.token_hash,
            expires_at: data.expires_at,
            accepted_at: data.accepted_at,
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.error('Error fetching invitation for staff:', err);
      }
    }

    const mock = MOCK_INVITATIONS.find(
      (i) => i.organization_id === orgId && (i.staff_profile_id === staffProfileId || i.id === staffProfileId) && !i.accepted_at
    );
    return mock || null;
  }

  /**
   * Generates or fetches an active invitation link for a staff member.
   */
  async getStaffInvitationLink(staffProfileId: string, orgId: string, email?: string): Promise<{ link: string; token: string } | null> {
    let inv = await this.getInvitationForStaff(staffProfileId, orgId);

    // If no existing token found, check by email
    if (!inv && email && isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('organization_invitations')
          .select('*')
          .eq('organization_id', orgId)
          .ilike('email', email.trim())
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          inv = {
            id: data.id,
            organization_id: data.organization_id,
            staff_profile_id: data.staff_profile_id,
            email: data.email,
            role_id: data.role_id,
            role_name: 'Staff',
            invited_by: data.invited_by,
            token: data.token_hash,
            expires_at: data.expires_at,
            accepted_at: data.accepted_at,
            created_at: data.created_at,
          };
        }
      } catch {}
    }

    if (inv?.token) {
      return { token: inv.token, link: this.getInvitationLink(inv.token) };
    }

    // If still no invitation exists, create a fresh token
    if (isSupabaseConfigured && email) {
      try {
        const newToken = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Find default role
        const { data: role } = await supabase.from('roles').select('id').eq('organization_id', orgId).limit(1).maybeSingle();

        if (role?.id) {
          await supabase.from('organization_invitations').insert({
            organization_id: orgId,
            staff_profile_id: staffProfileId,
            email: email.trim().toLowerCase(),
            role_id: role.id,
            invited_by: sessionData?.session?.user?.id || 'system',
            token_hash: newToken,
            expires_at: expiresAt,
          });

          await supabase.from('staff_profiles').update({ account_access_status: 'invited' }).eq('id', staffProfileId);

          return { token: newToken, link: this.getInvitationLink(newToken) };
        }
      } catch (err) {
        console.error('Failed to create invitation link:', err);
      }
    }

    return null;
  }

  /**
   * Accepts an invitation and provisions authentication membership.
   */
  async acceptInvitation(token: string, password?: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const inv = await this.getInvitationByToken(token);
    if (!inv) {
      return { success: false, error: 'Invitation link is invalid or has already been accepted.' };
    }

    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        // 1. Mark invitation as accepted in Supabase DB
        await supabase
          .from('organization_invitations')
          .update({ accepted_at: nowIso })
          .eq('id', inv.id);

        // 2. Update staff profile account_access_status to 'active'
        if (inv.staff_profile_id) {
          await supabase
            .from('staff_profiles')
            .update({ account_access_status: 'active', updated_at: nowIso })
            .eq('id', inv.staff_profile_id);
        } else {
          await supabase
            .from('staff_profiles')
            .update({ account_access_status: 'active', updated_at: nowIso })
            .eq('organization_id', inv.organization_id)
            .ilike('email', inv.email);
        }

        // 3. Update password if provided for currently logged-in user
        if (password) {
          await supabase.auth.updateUser({ password }).catch(() => null);
        }

        // 4. Ensure organization_members record exists
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;
        if (currentUserId) {
          const { data: existingMember } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', inv.organization_id)
            .eq('user_id', currentUserId)
            .maybeSingle();

          let memberId = existingMember?.id;
          if (!memberId) {
            const { data: newMember } = await supabase
              .from('organization_members')
              .insert({
                organization_id: inv.organization_id,
                user_id: currentUserId,
                status: 'active',
              })
              .select('id')
              .maybeSingle();
            if (newMember) memberId = newMember.id;
          }

          if (memberId && inv.role_id) {
            try {
              await supabase.from('member_roles').insert({
                organization_member_id: memberId,
                role_id: inv.role_id,
              });
            } catch {
              // role may already be assigned — ignore duplicate
            }

            if (inv.staff_profile_id) {
              await supabase
                .from('staff_profiles')
                .update({ organization_member_id: memberId })
                .eq('id', inv.staff_profile_id);
            }
          }
        }
      } catch (err) {
        console.error('Accept invitation DB operation failed:', err);
      }
    }

    inv.accepted_at = nowIso;

    await auditService.logEvent({
      organizationId: inv.organization_id,
      action: 'invitation.accepted',
      resourceType: 'organization_invitations',
      resourceId: inv.id,
      newValues: { email: inv.email },
    });

    return { success: true, email: inv.email };
  }
}

export const organizationService = new OrganizationService();
