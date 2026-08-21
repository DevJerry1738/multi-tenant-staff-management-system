import { supabase } from '@/lib/supabase/client';
import { MOCK_STAFF, MOCK_DEPARTMENTS, MOCK_ANNOUNCEMENTS } from '@/lib/tenant/mockData';
import { MOCK_INVITATIONS } from '@/lib/organizations/organizationService';
import type { StaffProfile, Department, Team, EmploymentType, EmploymentStatus } from '@/types/database';
import { auditService } from '@/lib/audit/auditService';

export interface GetStaffParams {
  orgId: string;
  search?: string;
  departmentId?: string;
  teamId?: string;
  employmentType?: string;
  employmentStatus?: string;
  accountStatus?: string; // 'active' | 'invited' | 'no_account'
  managerId?: string;
  sortBy?: keyof StaffProfile;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  /** Role scope restriction passed from application context */
  userScope?: 'organization' | 'team' | 'self';
  currentStaffId?: string;
  currentDepartmentId?: string;
  currentTeamId?: string;
}

export interface GetStaffResult {
  data: StaffProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateStaffInput {
  employee_number?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone: string;
  profile_photo_url?: string;
  gender?: string;
  date_of_birth?: string;
  job_title: string;
  department_id?: string;
  team_id?: string;
  manager_id?: string;
  employment_type: EmploymentType;
  employment_status?: EmploymentStatus;
  date_joined: string;
  address?: string;
  emergency_contact?: { name: string; relationship: string; phone: string };
  /** Mode B: Create login account access & send portal invitation */
  createLoginAccount?: boolean;
  assignedRoleId?: string;
  assignedRoleName?: string;
}

export interface UpdateStaffInput extends Partial<CreateStaffInput> {
  date_left?: string;
}

class StaffService {
  /**
   * Generates a unique employee number for an organization if not manually provided.
   * Format: EMP-0001
   */
  async generateEmployeeNumber(orgId: string): Promise<string> {
    const allStaff = await this.getAllStaffProfiles(orgId);
    const existingNums = allStaff
      .map((s) => s.employee_number)
      .filter((n) => n && n.startsWith('EMP-'))
      .map((n) => parseInt(n.replace('EMP-', ''), 10))
      .filter((n) => !isNaN(n));

    const max = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const nextNum = (max + 1).toString().padStart(4, '0');
    return `EMP-${nextNum}`;
  }

  /**
   * Validates whether setting `proposedManagerId` for `staffId` would create a management cycle.
   * E.g. Prevents A -> A, A -> B -> A, A -> B -> C -> A.
   */
  async checkCircularManager(
    staffId: string | null,
    proposedManagerId: string | null,
    orgId: string
  ): Promise<{ hasCycle: boolean; path?: string[] }> {
    if (!proposedManagerId) return { hasCycle: false };
    if (staffId && staffId === proposedManagerId) {
      return { hasCycle: true, path: ['Self-assignment'] };
    }

    const allStaff = await this.getAllStaffProfiles(orgId);
    const staffMap = new Map<string, StaffProfile>();
    allStaff.forEach((s) => staffMap.set(s.id, s));

    const visited = new Set<string>();
    if (staffId) visited.add(staffId);

    let currentId: string | null = proposedManagerId;
    const path: string[] = [proposedManagerId];

    while (currentId) {
      if (staffId && currentId === staffId) {
        return { hasCycle: true, path };
      }
      if (visited.has(currentId)) {
        break; // Cycle elsewhere or already checked
      }
      visited.add(currentId);

      const currentStaff = staffMap.get(currentId);
      currentId = currentStaff?.manager_id || null;
      if (currentId) path.push(currentId);
    }

    return { hasCycle: false };
  }

  /**
   * Fetches paginated, searched, sorted, filtered staff profiles.
   */
  async getStaffProfiles(params: GetStaffParams): Promise<GetStaffResult> {
    const {
      orgId,
      search = '',
      departmentId,
      teamId,
      employmentType,
      employmentStatus,
      accountStatus,
      managerId,
      sortBy = 'first_name',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
      userScope = 'organization',
      currentStaffId,
      currentDepartmentId,
      currentTeamId,
    } = params;

    let list = await this.getAllStaffProfiles(orgId);

    // ── 1. Apply Scope Rules ────────────────────────────────────────────────
    if (userScope === 'self' && currentStaffId) {
      // Staff role: see self or limited directory
      // Note: Data filtering preserves full list for limited directory UI, but profile details are restricted
    } else if (userScope === 'team') {
      // Manager role: scope to assigned department/team/direct reports
      list = list.filter(
        (s) =>
          (currentDepartmentId && s.department_id === currentDepartmentId) ||
          (currentTeamId && s.team_id === currentTeamId) ||
          (currentStaffId && s.manager_id === currentStaffId) ||
          s.id === currentStaffId
      );
    }

    // ── 2. Apply Filters ────────────────────────────────────────────────────
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
          s.employee_number.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.job_title.toLowerCase().includes(q)
      );
    }

    if (departmentId && departmentId !== 'all') {
      list = list.filter((s) => s.department_id === departmentId);
    }

    if (teamId && teamId !== 'all') {
      list = list.filter((s) => s.team_id === teamId);
    }

    if (employmentType && employmentType !== 'all') {
      list = list.filter((s) => s.employment_type === employmentType);
    }

    if (employmentStatus && employmentStatus !== 'all') {
      list = list.filter((s) => s.employment_status === employmentStatus);
    }

    if (managerId && managerId !== 'all') {
      list = list.filter((s) => s.manager_id === managerId);
    }

    if (accountStatus && accountStatus !== 'all') {
      if (accountStatus === 'active') {
        list = list.filter((s) => s.organization_member_id !== null);
      } else if (accountStatus === 'no_account') {
        list = list.filter((s) => s.organization_member_id === null);
      }
    }

    // ── 3. Apply Sorting ────────────────────────────────────────────────────
    list.sort((a, b) => {
      let valA = (a[sortBy] || '') as string;
      let valB = (b[sortBy] || '') as string;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // ── 4. Pagination ───────────────────────────────────────────────────────
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = list.slice(startIndex, startIndex + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Fetches a single staff profile by ID with organization verification.
   */
  async getStaffProfileById(id: string, orgId: string): Promise<StaffProfile | null> {
    const allStaff = await this.getAllStaffProfiles(orgId);
    const staff = allStaff.find((s) => s.id === id && s.organization_id === orgId);
    return staff || null;
  }

  /**
   * Creates a new staff profile.
   */
  async createStaffProfile(
    input: CreateStaffInput,
    orgId: string,
    actorMemberId?: string
  ): Promise<{ data: StaffProfile | null; error?: string }> {
    // 1. Employee Number
    const empNum = input.employee_number || (await this.generateEmployeeNumber(orgId));

    // Check unique constraint within organization
    const existing = await this.getAllStaffProfiles(orgId);
    if (existing.some((s) => s.employee_number.toLowerCase() === empNum.toLowerCase())) {
      return { data: null, error: `Employee number "${empNum}" already exists in this organization.` };
    }

    // 2. Circular manager check
    if (input.manager_id) {
      const { hasCycle } = await this.checkCircularManager(null, input.manager_id, orgId);
      if (hasCycle) {
        return { data: null, error: 'Selected manager assignment creates a circular management relationship.' };
      }
    }

    // ── Mode A vs Mode B: Determine account access status ──────────────────
    const createLogin = !!input.createLoginAccount;
    const memberId = createLogin ? `mem-${Date.now()}` : null;

    const newStaff: StaffProfile = {
      id: `staff-${Date.now()}`,
      organization_id: orgId,
      organization_member_id: memberId,
      employee_number: empNum,
      first_name: input.first_name,
      middle_name: input.middle_name || null,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      profile_photo_url: input.profile_photo_url || null,
      gender: input.gender || null,
      date_of_birth: input.date_of_birth || null,
      job_title: input.job_title,
      department_id: input.department_id || null,
      team_id: input.team_id || null,
      manager_id: input.manager_id || null,
      employment_type: input.employment_type,
      employment_status: input.employment_status || 'active',
      account_access_status: createLogin ? 'invited' : 'no_account',
      date_joined: input.date_joined,
      date_left: null,
      address: input.address || null,
      emergency_contact: input.emergency_contact || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Attempt Supabase DB Insert
    try {
      const { data, error } = await supabase.from('staff_profiles').insert([newStaff]).select().single();
      if (error) {
        this.saveToMock(orgId, newStaff);
      } else if (data) {
        newStaff.id = data.id;
      }
    } catch {
      this.saveToMock(orgId, newStaff);
    }

    // ── Mode B: Generate portal invitation ─────────────────────────────────
    if (createLogin && memberId) {
      const token = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      MOCK_INVITATIONS.push({
        id: `inv-staff-${Date.now()}`,
        organization_id: orgId,
        email: input.email.toLowerCase().trim(),
        role_id: input.assignedRoleId || `role-${orgId}-staff`,
        role_name: input.assignedRoleName || 'Staff',
        invited_by: actorMemberId || 'system',
        token,
        expires_at: expiresAt,
        accepted_at: null,
        created_at: new Date().toISOString(),
      });

      await auditService.logEvent({
        organizationId: orgId,
        actorMemberId,
        action: 'staff.account_created',
        resourceType: 'staff_profiles',
        resourceId: newStaff.id,
        newValues: { email: newStaff.email, role: input.assignedRoleName || 'Staff', token },
      });

      await auditService.logEvent({
        organizationId: orgId,
        actorMemberId,
        action: 'staff.invited',
        resourceType: 'organization_invitations',
        resourceId: memberId,
        newValues: { email: newStaff.email, role: input.assignedRoleName || 'Staff' },
      });
    }

    // Audit Log
    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: 'staff.created',
      resourceType: 'staff_profiles',
      resourceId: newStaff.id,
      newValues: {
        employee_number: newStaff.employee_number,
        name: `${newStaff.first_name} ${newStaff.last_name}`,
        email: newStaff.email,
        job_title: newStaff.job_title,
        has_login_access: createLogin,
      },
    });

    return { data: newStaff };
  }

  /**
   * Updates an existing staff profile.
   */
  async updateStaffProfile(
    id: string,
    input: UpdateStaffInput,
    orgId: string,
    actorMemberId?: string
  ): Promise<{ data: StaffProfile | null; error?: string }> {
    const existing = await this.getStaffProfileById(id, orgId);
    if (!existing) {
      return { data: null, error: 'Staff profile not found.' };
    }

    // Circular manager check
    if (input.manager_id && input.manager_id !== existing.manager_id) {
      const { hasCycle } = await this.checkCircularManager(id, input.manager_id, orgId);
      if (hasCycle) {
        return { data: null, error: 'Updating this manager assignment creates a circular management relationship.' };
      }
    }

    const updated: StaffProfile = {
      ...existing,
      ...input,
      employee_number: existing.employee_number, // Immutable
      organization_id: orgId, // Immutable
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('staff_profiles').update(updated).eq('id', id);
      if (error) {
        this.updateMock(orgId, updated);
      }
    } catch {
      this.updateMock(orgId, updated);
    }

    // Audit Log
    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: 'staff.updated',
      resourceType: 'staff_profiles',
      resourceId: id,
      oldValues: {
        job_title: existing.job_title,
        department_id: existing.department_id,
        team_id: existing.team_id,
        manager_id: existing.manager_id,
        employment_status: existing.employment_status,
      },
      newValues: {
        job_title: updated.job_title,
        department_id: updated.department_id,
        team_id: updated.team_id,
        manager_id: updated.manager_id,
        employment_status: updated.employment_status,
      },
    });

    return { data: updated };
  }

  /**
   * Deactivates or reactivates a staff member (Soft archive semantics).
   */
  async setStaffActiveStatus(
    id: string,
    isActive: boolean,
    orgId: string,
    actorMemberId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const staff = await this.getStaffProfileById(id, orgId);
    if (!staff) return { success: false, error: 'Staff profile not found.' };

    const newStatus: EmploymentStatus = isActive ? 'active' : 'inactive';
    const result = await this.updateStaffProfile(
      id,
      { employment_status: newStatus, date_left: isActive ? undefined : new Date().toISOString().split('T')[0] },
      orgId,
      actorMemberId
    );

    if (result.error) return { success: false, error: result.error };

    // Audit Event
    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: isActive ? 'staff.reactivated' : 'staff.deactivated',
      resourceType: 'staff_profiles',
      resourceId: id,
      newValues: { employment_status: newStatus },
    });

    return { success: true };
  }

  // ── DEPARTMENTS MANAGEMENT ──────────────────────────────────────────────────

  async getDepartments(orgId: string): Promise<Department[]> {
    try {
      const { data, error } = await supabase.from('departments').select('*').eq('organization_id', orgId);
      if (error || !data || data.length === 0) {
        return MOCK_DEPARTMENTS[orgId] || [];
      }
      return data;
    } catch {
      return MOCK_DEPARTMENTS[orgId] || [];
    }
  }

  async createDepartment(
    name: string,
    description: string | null,
    managerId: string | null,
    orgId: string,
    actorMemberId?: string
  ): Promise<Department> {
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      organization_id: orgId,
      name,
      description,
      manager_id: managerId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!MOCK_DEPARTMENTS[orgId]) MOCK_DEPARTMENTS[orgId] = [];
    MOCK_DEPARTMENTS[orgId].push(newDept);

    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: 'department.created',
      resourceType: 'departments',
      resourceId: newDept.id,
      newValues: { name, description, manager_id: managerId },
    });

    return newDept;
  }

  // ── TEAMS MANAGEMENT ────────────────────────────────────────────────────────

  async getTeams(orgId: string, departmentId?: string): Promise<Team[]> {
    const teams: Team[] = [
      {
        id: 'team-a1',
        organization_id: '11111111-1111-1111-1111-111111111111',
        department_id: 'dept-a1',
        name: 'Luxury Residential',
        description: 'High value properties unit',
        manager_id: 'staff-a1',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'team-a2',
        organization_id: '11111111-1111-1111-1111-111111111111',
        department_id: 'dept-a1',
        name: 'Commercial Leasing',
        description: 'Office & retail spaces unit',
        manager_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const filtered = teams.filter((t) => t.organization_id === orgId);
    if (departmentId && departmentId !== 'all') {
      return filtered.filter((t) => t.department_id === departmentId);
    }
    return filtered;
  }

  async createTeam(
    name: string,
    departmentId: string | null,
    description: string | null,
    managerId: string | null,
    orgId: string,
    actorMemberId?: string
  ): Promise<Team> {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      organization_id: orgId,
      department_id: departmentId,
      name,
      description,
      manager_id: managerId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: 'team.created',
      resourceType: 'teams',
      resourceId: newTeam.id,
      newValues: { name, department_id: departmentId, manager_id: managerId },
    });

    return newTeam;
  }

  // ── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private async getAllStaffProfiles(orgId: string): Promise<StaffProfile[]> {
    try {
      const { data, error } = await supabase.from('staff_profiles').select('*').eq('organization_id', orgId);
      if (error || !data || data.length === 0) {
        return MOCK_STAFF[orgId] || [];
      }
      return data;
    } catch {
      return MOCK_STAFF[orgId] || [];
    }
  }

  private saveToMock(orgId: string, staff: StaffProfile) {
    if (!MOCK_STAFF[orgId]) MOCK_STAFF[orgId] = [];
    MOCK_STAFF[orgId].unshift(staff);
  }

  private updateMock(orgId: string, staff: StaffProfile) {
    if (!MOCK_STAFF[orgId]) return;
    const index = MOCK_STAFF[orgId].findIndex((s) => s.id === staff.id);
    if (index !== -1) {
      MOCK_STAFF[orgId][index] = staff;
    }
  }
}

export const staffService = new StaffService();
