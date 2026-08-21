import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/TenantContext';
import { staffService } from '@/lib/staff/staffService';
import type { GetStaffResult } from '@/lib/staff/staffService';
import type { StaffProfile, Department, Team } from '@/types/database';
import { StaffLayout } from './StaffLayout';
import { StaffFormModal } from './StaffFormModal';
import { DeactivateStaffModal } from './DeactivateStaffModal';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import {
  Search,
  Filter,
  UserCheck,
  UserX,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Shield,
  ArrowUpDown,
  Building2,
  Phone,
  Mail,
  UserCircle2,
} from 'lucide-react';

export const StaffDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrganization, activeRoles, hasPermission } = useTenant();
  const orgId = activeOrganization?.id || '';

  // Determine user scope based on assigned roles
  const isAdminOrHR = activeRoles.some(
    (r) => r.name === 'Organization Admin' || r.name === 'HR Manager'
  );
  const isManager = activeRoles.some((r) => r.name === 'Manager');
  const userScope: 'organization' | 'team' | 'self' = isAdminOrHR
    ? 'organization'
    : isManager
    ? 'team'
    : 'self';

  // State
  const [result, setResult] = useState<GetStaffResult>({
    data: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Filters & Query State
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [teamId, setTeamId] = useState('all');
  const [employmentType, setEmploymentType] = useState('all');
  const [employmentStatus, setEmploymentStatus] = useState('all');
  const [accountStatus, setAccountStatus] = useState('all');
  const [sortBy, setSortBy] = useState<keyof StaffProfile>('first_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffProfile | null>(null);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [staffToDeactivate, setStaffToDeactivate] = useState<StaffProfile | null>(null);

  // Load Department & Team filter options
  useEffect(() => {
    if (!orgId) return;
    staffService.getDepartments(orgId).then(setDepartments);
    staffService.getTeams(orgId).then(setTeams);
  }, [orgId]);

  // Fetch paginated staff records
  const fetchStaff = async () => {
    if (!orgId) return;
    setLoading(true);

    const res = await staffService.getStaffProfiles({
      orgId,
      search,
      departmentId,
      teamId,
      employmentType,
      employmentStatus,
      accountStatus,
      sortBy,
      sortOrder,
      page,
      limit: 10,
      userScope,
    });

    setResult(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, [
    orgId,
    search,
    departmentId,
    teamId,
    employmentType,
    employmentStatus,
    accountStatus,
    sortBy,
    sortOrder,
    page,
  ]);

  const handleSort = (field: keyof StaffProfile) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getDeptName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return departments.find((d) => d.id === id)?.name || 'Department';
  };

  const getTeamName = (id: string | null) => {
    if (!id) return '—';
    return teams.find((t) => t.id === id)?.name || 'Team';
  };

  return (
    <StaffLayout onAddStaffClick={() => { setStaffToEdit(null); setFormModalOpen(true); }}>
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <Card className="border-slate-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search staff by name, employee #, email, job title..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Summary Badge */}
              <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                <span className="font-semibold text-slate-800">{result.total}</span> staff members found
              </div>
            </div>

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
              {/* Department Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Team</label>
                <select
                  value={teamId}
                  onChange={(e) => { setTeamId(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Employment Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Types</option>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                  <option value="temporary">Temporary</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
                <select
                  value={employmentStatus}
                  onChange={(e) => { setEmploymentStatus(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              {/* Account Linked */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Account</label>
                <select
                  value={accountStatus}
                  onChange={(e) => { setAccountStatus(e.target.value); setPage(1); }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700"
                >
                  <option value="all">All Accounts</option>
                  <option value="active">Account Active</option>
                  <option value="no_account">No Login Yet</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table View (Desktop) */}
        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4 w-28 cursor-pointer hover:text-slate-900" onClick={() => handleSort('employee_number')}>
                    <div className="flex items-center gap-1">Emp # <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('first_name')}>
                    <div className="flex items-center gap-1">Staff Member <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('job_title')}>
                    <div className="flex items-center gap-1">Job Title <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="py-3 px-4">Department / Team</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Account</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading staff profiles…
                    </td>
                  </tr>
                ) : result.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <UserX size={32} className="mx-auto text-slate-300" />
                        <div className="font-semibold text-slate-700">No staff members found</div>
                        <p className="text-[11px] text-slate-400">
                          Try adjusting your search query or clear existing filter selections.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  result.data.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Employee # */}
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-indigo-600">
                        {staff.employee_number}
                      </td>

                      {/* Staff Member (Photo + Name + Email) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                            {staff.first_name[0]}{staff.last_name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {staff.first_name} {staff.middle_name ? `${staff.middle_name} ` : ''}{staff.last_name}
                            </div>
                            {/* Standard directory view shows work email */}
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Mail size={10} /> {staff.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Job Title */}
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {staff.job_title}
                      </td>

                      {/* Department / Team */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{getDeptName(staff.department_id)}</div>
                        <div className="text-[10px] text-slate-400">{getTeamName(staff.team_id)}</div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {staff.employment_type.replace('_', ' ')}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {staff.employment_status === 'active' ? (
                          <Badge variant="success" className="text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-500">
                            {staff.employment_status}
                          </Badge>
                        )}
                      </td>

                      {/* Portal Login Status */}
                      <td className="py-3 px-4 text-center">
                        {(() => {
                          const status = staff.account_access_status || (staff.organization_member_id ? 'active' : 'no_account');
                          const cfg: Record<string, { label: string; cls: string }> = {
                            no_account:  { label: 'No Account',          cls: 'border-slate-200 text-slate-400 bg-slate-50' },
                            invited:     { label: 'Invitation Pending',  cls: 'border-amber-200 text-amber-700 bg-amber-50' },
                            active:      { label: 'Active',              cls: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
                            suspended:   { label: 'Suspended',           cls: 'border-rose-200 text-rose-600 bg-rose-50' },
                            deactivated: { label: 'Deactivated',         cls: 'border-slate-200 text-slate-400 bg-slate-50 line-through' },
                          };
                          const { label, cls } = cfg[status] || cfg.no_account;
                          return <Badge variant="outline" className={`text-[9px] ${cls}`}>{label}</Badge>;
                        })()}
                      </td>


                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Profile */}
                          <button
                            onClick={() => navigate(`/staff/${staff.id}`)}
                            title="View Staff Profile"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Edit (Admin & HR) */}
                          <PermissionGuard permission="staff.update">
                            <button
                              onClick={() => { setStaffToEdit(staff); setFormModalOpen(true); }}
                              title="Edit Staff Member"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
                            >
                              <Edit2 size={14} />
                            </button>
                          </PermissionGuard>

                          {/* Deactivate/Reactivate (Admin & HR) */}
                          <PermissionGuard permission="staff.archive">
                            <button
                              onClick={() => { setStaffToDeactivate(staff); setDeactivateModalOpen(true); }}
                              title={staff.employment_status === 'active' ? 'Deactivate' : 'Reactivate'}
                              className={`p-1.5 rounded hover:bg-slate-100 ${staff.employment_status === 'active' ? 'text-slate-400 hover:text-amber-600' : 'text-emerald-500 hover:text-emerald-700'}`}
                            >
                              {staff.employment_status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page <span className="font-semibold text-slate-800">{result.page}</span> of{' '}
              <span className="font-semibold text-slate-800">{result.totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={14} /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Staff Form Modal (Create / Edit) */}
      <StaffFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={fetchStaff}
        staffToEdit={staffToEdit}
      />

      {/* Deactivate / Reactivate Confirmation Modal */}
      <DeactivateStaffModal
        isOpen={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        onSuccess={fetchStaff}
        staff={staffToDeactivate}
        orgId={orgId}
      />
    </StaffLayout>
  );
};
