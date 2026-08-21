import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { staffService } from '@/lib/staff/staffService';
import type { Team, Department, StaffProfile } from '@/types/database';
import { StaffLayout } from './StaffLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui';
import { Layers, Users, X, Save } from 'lucide-react';

export const TeamsPage: React.FC = () => {
  const { activeOrganization } = useTenant();
  const orgId = activeOrganization?.id || '';

  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);

    const depts = await staffService.getDepartments(orgId);
    setDepartments(depts);

    const teamList = await staffService.getTeams(orgId, selectedDeptId);
    const staffRes = await staffService.getStaffProfiles({ orgId, limit: 100 });
    setStaffList(staffRes.data);

    // Enrich teams with staff count and manager name
    const enriched = teamList.map((t) => {
      const count = staffRes.data.filter((s) => s.team_id === t.id).length;
      const dept = depts.find((d) => d.id === t.department_id);
      const mgr = staffRes.data.find((s) => s.id === t.manager_id);
      return {
        ...t,
        staff_count: count,
        department_name: dept ? dept.name : 'No Department',
        manager_name: mgr ? `${mgr.first_name} ${mgr.last_name}` : 'Unassigned',
      };
    });

    setTeams(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [orgId, selectedDeptId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    await staffService.createTeam(
      name.trim(),
      departmentId || null,
      description.trim() || null,
      managerId || null,
      orgId
    );

    setSubmitting(false);
    setModalOpen(false);
    setName('');
    setDepartmentId('');
    setDescription('');
    setManagerId('');
    loadData();
  };

  return (
    <StaffLayout onAddTeamClick={() => setModalOpen(true)}>
      <div className="space-y-4">
        {/* Department Filter Header */}
        <Card className="border-slate-200">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter by Department:</span>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              {teams.length} teams
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-semibold">
            Loading teams…
          </div>
        ) : teams.length === 0 ? (
          <Card className="border-slate-200 p-12 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Teams Found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Create your first team to organize staff members into functional units.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Card key={team.id} className="border-slate-200 hover:border-slate-300 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        <Layers size={16} />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{team.name}</CardTitle>
                        <CardDescription className="text-[11px] line-clamp-1">{team.description || 'No description'}</CardDescription>
                      </div>
                    </div>
                    {team.is_active ? (
                      <Badge variant="success" className="text-[9px]">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px]">Inactive</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-xs space-y-2 border-t border-slate-100 mt-2">
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-400">Department</span>
                    <Badge variant="outline" className="text-[10px]">{team.department_name}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Team Lead</span>
                    <span className="font-semibold text-slate-800">{team.manager_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Team Members</span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      <Users size={12} className="mr-1" /> {team.staff_count || 0}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Team Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Add Team</h3>
                <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Luxury Residential, Commercial Leasing"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    <option value="">Select department (optional)...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Brief team scope or focus area"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Team Lead / Manager</label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    <option value="">Select team lead...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} ({s.job_title})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={submitting} className="bg-indigo-600 text-white">
                    <Save size={14} className="mr-1.5" /> Save Team
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  );
};
