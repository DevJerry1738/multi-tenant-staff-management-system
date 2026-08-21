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
  admin_password?: string;
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

// In-memory store for pending invitations
export const MOCK_INVITATIONS: OrganizationInvitation[] = [];

class OrganizationService {
  /**
   * Retrieves all organizations (Platform Admin view).
   */
  async getOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (error || !data || data.length === 0) {
        return MOCK_ORGANIZATIONS;
      }
      return data;
    } catch {
      return MOCK_ORGANIZATIONS;
    }
  }

  /**
   * Retrieves a single organization by ID.
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    const all = await this.getOrganizations();
    return all.find((o) => o.id === id) || null;
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
   * Fetches an invitation by token.
   */
  async getInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
    const inv = MOCK_INVITATIONS.find((i) => i.token === token && !i.accepted_at);
    return inv || null;
  }

  /**
   * Accepts an invitation and provisions authentication membership.
   */
  async acceptInvitation(token: string, _password: string): Promise<{ success: boolean; email?: string; error?: string }> {
    const inv = await this.getInvitationByToken(token);
    if (!inv) {
      return { success: false, error: 'Invitation link is invalid or has already been accepted.' };
    }

    inv.accepted_at = new Date().toISOString();

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
