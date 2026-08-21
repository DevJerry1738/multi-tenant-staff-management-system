import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/lib/tenant/TenantContext';
import { staffService } from '@/lib/staff/staffService';
import type { StaffProfile, Department, Team } from '@/types/database';
import { StaffLayout } from './StaffLayout';
import { StaffFormModal } from './StaffFormModal';
import { DeactivateStaffModal } from './DeactivateStaffModal';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  UserCheck,
  Shield,
  MapPin,
  Heart,
  Edit2,
  UserX,
  User,
  Briefcase,
  Clock,
  Lock,
} from 'lucide-react';

export const StaffDetailPage: React.FC = () => {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const { activeOrganization, activeRoles } = useTenant();
  const orgId = activeOrganization?.id || '';

  const isAdminOrHR = activeRoles.some(
    (r) => r.name === 'Organization Admin' || r.name === 'HR Manager'
  );

  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [manager, setManager] = useState<StaffProfile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'employment' | 'organization' | 'contact' | 'emergency' | 'account'
  >('overview');

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);

  const loadProfile = async () => {
    if (!staffId || !orgId) return;
    setLoading(true);
    setNotFound(false);

    const profile = await staffService.getStaffProfileById(staffId, orgId);
    if (!profile) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setStaff(profile);

    // Fetch related labels
    if (profile.manager_id) {
      const mgr = await staffService.getStaffProfileById(profile.manager_id, orgId);
      setManager(mgr);
    }
    if (profile.department_id) {
      const depts = await staffService.getDepartments(orgId);
      setDepartment(depts.find((d) => d.id === profile.department_id) || null);
    }
    if (profile.team_id) {
      const teams = await staffService.getTeams(orgId);
      setTeam(teams.find((t) => t.id === profile.team_id) || null);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [staffId, orgId]);

  if (loading) {
    return (
      <StaffLayout>
        <div className="py-16 text-center text-slate-400 text-xs font-semibold">
          Loading employee profile details…
        </div>
      </StaffLayout>
    );
  }

  if (notFound || !staff) {
    return (
      <StaffLayout>
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto text-rose-600">
            <Lock size={24} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Staff Member Not Found</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              This staff profile does not exist or does not belong to your organization. Multi-tenant access controls have blocked this request.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/staff')}>
            <ArrowLeft size={14} className="mr-1.5" /> Back to Staff Directory
          </Button>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/staff')} className="text-slate-600">
            <ArrowLeft size={14} className="mr-1.5" /> Back to Staff Directory
          </Button>

          <div className="flex items-center gap-2">
            <PermissionGuard permission="staff.update">
              <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)}>
                <Edit2 size={14} className="mr-1.5" /> Edit Profile
              </Button>
            </PermissionGuard>

            <PermissionGuard permission="staff.archive">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeactivateModalOpen(true)}
                className={staff.employment_status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
              >
                {staff.employment_status === 'active' ? (
                  <><UserX size={14} className="mr-1.5" /> Deactivate</>
                ) : (
                  <><UserCheck size={14} className="mr-1.5" /> Reactivate</>
                )}
              </Button>
            </PermissionGuard>
          </div>
        </div>

        {/* Profile Header Hero Card */}
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200 shrink-0">
                {staff.first_name[0]}{staff.last_name[0]}
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">
                    {staff.first_name} {staff.middle_name ? `${staff.middle_name} ` : ''}{staff.last_name}
                  </h1>
                  {staff.employment_status === 'active' ? (
                    <Badge variant="success" className="text-[10px]">Active Employee</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-500">
                      {staff.employment_status}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono">{staff.employee_number}</Badge>
                </div>

                <p className="text-sm font-medium text-slate-600">{staff.job_title}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={14} className="text-slate-400" />
                    <span>{department?.name || 'No department'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    <span>{staff.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" />
                    <span>{staff.phone || 'No phone'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex flex-wrap gap-1 mt-6 pt-4 border-t border-slate-100">
              {(
                [
                  { key: 'overview', label: 'Overview', icon: User },
                  { key: 'employment', label: 'Employment', icon: Briefcase },
                  { key: 'organization', label: 'Organization', icon: Building2 },
                  { key: 'contact', label: 'Contact', icon: Mail },
                  { key: 'emergency', label: 'Emergency Contact', icon: Heart, restricted: !isAdminOrHR },
                  { key: 'account', label: 'Account Link', icon: Lock },
                ] as const
              ).map((tab) => {
                if ('restricted' in tab && tab.restricted) return null;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} /> {tab.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tab Content Cards */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">Core Identity</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div><span className="text-slate-400 block text-[10px]">Full Name</span><span className="font-semibold text-slate-900">{staff.first_name} {staff.middle_name} {staff.last_name}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Employee Number</span><span className="font-mono text-indigo-600 font-semibold">{staff.employee_number}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Job Title</span><span className="font-medium text-slate-800">{staff.job_title}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Gender</span><span className="text-slate-800">{staff.gender || 'Not specified'}</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">Placement Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div><span className="text-slate-400 block text-[10px]">Department</span><span className="font-semibold text-slate-900">{department?.name || 'Unassigned'}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Team</span><span className="font-medium text-slate-800">{team?.name || 'Unassigned'}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Assigned Manager</span><span className="font-medium text-slate-800">{manager ? `${manager.first_name} ${manager.last_name} (${manager.job_title})` : 'No direct manager'}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Date Joined</span><span className="text-slate-800">{staff.date_joined}</span></div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'employment' && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">Employment Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div><span className="text-slate-400 block text-[10px]">Employment Type</span><Badge variant="outline" className="capitalize mt-0.5">{staff.employment_type.replace('_', ' ')}</Badge></div>
              <div><span className="text-slate-400 block text-[10px]">Status</span><Badge variant={staff.employment_status === 'active' ? 'success' : 'secondary'} className="capitalize mt-0.5">{staff.employment_status}</Badge></div>
              <div><span className="text-slate-400 block text-[10px]">Date Joined</span><span className="font-semibold text-slate-900">{staff.date_joined}</span></div>
              <div><span className="text-slate-400 block text-[10px]">Date Left</span><span className="text-slate-800">{staff.date_left || 'Currently Active'}</span></div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'organization' && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">Organization Structure</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Department</div>
                  <div className="font-bold text-slate-900 text-sm">{department?.name || 'Unassigned'}</div>
                  <p className="text-[11px] text-slate-500">{department?.description}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Team</div>
                  <div className="font-bold text-slate-900 text-sm">{team?.name || 'Unassigned'}</div>
                  <p className="text-[11px] text-slate-500">{team?.description}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Direct Manager</div>
                  <div className="font-bold text-slate-900 text-sm">{manager ? `${manager.first_name} ${manager.last_name}` : 'None'}</div>
                  <p className="text-[11px] text-slate-500">{manager?.job_title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'contact' && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div><span className="text-slate-400 block text-[10px]">Work Email</span><span className="font-semibold text-slate-900">{staff.email}</span></div>
              <div><span className="text-slate-400 block text-[10px]">Phone Number</span><span className="text-slate-800">{staff.phone}</span></div>
              {isAdminOrHR && (
                <div><span className="text-slate-400 block text-[10px]">Residential Address</span><span className="text-slate-800">{staff.address || 'No address provided'}</span></div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'emergency' && isAdminOrHR && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">Emergency Contact</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              {staff.emergency_contact ? (
                <>
                  <div><span className="text-slate-400 block text-[10px]">Contact Name</span><span className="font-semibold text-slate-900">{staff.emergency_contact.name}</span></div>
                  <div><span className="text-slate-400 block text-[10px]">Relationship</span><span className="text-slate-800">{staff.emergency_contact.relationship}</span></div>
                  <div><span className="text-slate-400 block text-[10px]">Phone</span><span className="text-slate-800">{staff.emergency_contact.phone}</span></div>
                </>
              ) : (
                <p className="text-slate-400 italic">No emergency contact on record.</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'account' && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-400">User Account Association</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Account Link Status</span>
                {staff.organization_member_id ? (
                  <Badge variant="success" className="mt-1">Linked to Organization Member Account ({staff.organization_member_id})</Badge>
                ) : (
                  <Badge variant="outline" className="mt-1 border-slate-200 text-slate-500">No Login Account Linked Yet</Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Staff records can exist independently before a login account is provisioned for tenant access.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Staff Modal */}
      <StaffFormModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={loadProfile}
        staffToEdit={staff}
      />

      {/* Deactivate Modal */}
      <DeactivateStaffModal
        isOpen={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        onSuccess={loadProfile}
        staff={staff}
        orgId={orgId}
      />
    </StaffLayout>
  );
};
