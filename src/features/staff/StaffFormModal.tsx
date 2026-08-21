import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { staffService } from '@/lib/staff/staffService';
import type { CreateStaffInput } from '@/lib/staff/staffService';
import type { StaffProfile, Department, Team, EmploymentType, EmploymentStatus } from '@/types/database';
import { Button } from '@/components/ui';
import { X, UserPlus, Save, AlertCircle, ShieldCheck, ShieldOff } from 'lucide-react';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffToEdit?: StaffProfile | null;
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  staffToEdit,
}) => {
  const { activeOrganization } = useTenant();
  const orgId = activeOrganization?.id || '';

  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [managers, setManagers] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>('active');
  const [dateJoined, setDateJoined] = useState(new Date().toISOString().split('T')[0]);
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  // Login Access (Mode B)
  const [createLoginAccount, setCreateLoginAccount] = useState(false);
  const [assignedRoleName, setAssignedRoleName] = useState('Staff');

  // Load dropdown data
  useEffect(() => {
    if (!isOpen || !orgId) return;

    const loadData = async () => {
      const depts = await staffService.getDepartments(orgId);
      setDepartments(depts);

      const allTeams = await staffService.getTeams(orgId);
      setTeams(allTeams);

      const staffList = await staffService.getStaffProfiles({ orgId, limit: 100 });
      setManagers(staffList.data.filter((s) => s.id !== staffToEdit?.id));

      if (staffToEdit) {
        setFirstName(staffToEdit.first_name);
        setMiddleName(staffToEdit.middle_name || '');
        setLastName(staffToEdit.last_name);
        setEmail(staffToEdit.email);
        setPhone(staffToEdit.phone);
        setEmployeeNumber(staffToEdit.employee_number);
        setJobTitle(staffToEdit.job_title);
        setDepartmentId(staffToEdit.department_id || '');
        setTeamId(staffToEdit.team_id || '');
        setManagerId(staffToEdit.manager_id || '');
        setEmploymentType(staffToEdit.employment_type);
        setEmploymentStatus(staffToEdit.employment_status);
        setDateJoined(staffToEdit.date_joined);
        setGender(staffToEdit.gender || '');
        setDateOfBirth(staffToEdit.date_of_birth || '');
        setAddress(staffToEdit.address || '');

        if (staffToEdit.emergency_contact) {
          setEmergencyName(staffToEdit.emergency_contact.name || '');
          setEmergencyRelation(staffToEdit.emergency_contact.relationship || '');
          setEmergencyPhone(staffToEdit.emergency_contact.phone || '');
        }
      } else {
        // Create mode: auto-generate preview number
        const num = await staffService.generateEmployeeNumber(orgId);
        setEmployeeNumber(num);
      }
    };

    loadData();
  }, [isOpen, orgId, staffToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !jobTitle.trim()) {
      setError('Please fill in all required fields marked with *.');
      return;
    }

    setLoading(true);

    const inputData: CreateStaffInput = {
      employee_number: employeeNumber.trim(),
      first_name: firstName.trim(),
      middle_name: middleName.trim() || undefined,
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      gender: gender || undefined,
      date_of_birth: dateOfBirth || undefined,
      job_title: jobTitle.trim(),
      department_id: departmentId || undefined,
      team_id: teamId || undefined,
      manager_id: managerId || undefined,
      employment_type: employmentType,
      employment_status: employmentStatus,
      date_joined: dateJoined,
      address: address.trim() || undefined,
      emergency_contact: emergencyName.trim()
        ? { name: emergencyName.trim(), relationship: emergencyRelation.trim(), phone: emergencyPhone.trim() }
        : undefined,
      // Mode B fields
      createLoginAccount: !staffToEdit ? createLoginAccount : undefined,
      assignedRoleName: !staffToEdit && createLoginAccount ? assignedRoleName : undefined,
    };

    if (staffToEdit) {
      const res = await staffService.updateStaffProfile(staffToEdit.id, inputData, orgId);
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } else {
      const res = await staffService.createStaffProfile(inputData, orgId);
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess();
        onClose();
      }
    }
  };

  const filteredTeams = teams.filter((t) => !departmentId || t.department_id === departmentId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {staffToEdit ? `Edit Staff Member — ${staffToEdit.first_name} ${staffToEdit.last_name}` : 'Add New Staff Member'}
              </h2>
              <p className="text-xs text-slate-500">
                {staffToEdit ? 'Update employee record details.' : 'Enter employee details for organization onboarding.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Personal Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select gender...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Employment Information */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Employment Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Number</label>
                <input
                  type="text"
                  value={employeeNumber}
                  disabled={!!staffToEdit}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date Joined *</label>
                <input
                  type="date"
                  required
                  value={dateJoined}
                  onChange={(e) => setDateJoined(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setTeamId(''); // Reset team when department changes
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team</label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No team</option>
                  {filteredTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Manager</label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No direct manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.job_title})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type *</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                  <option value="temporary">Temporary</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Status</label>
                <select
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Contact & Emergency */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">3. Contact & Emergency Contact</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, city, country"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                <input
                  type="text"
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                  placeholder="Spouse, Parent, Sibling"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Portal Login Access — create mode only */}
          {!staffToEdit && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">4. Portal Login Access</h3>

              <div className={`rounded-xl border-2 p-4 transition-colors ${createLoginAccount ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id="create-login-account"
                    checked={createLoginAccount}
                    onChange={(e) => setCreateLoginAccount(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {createLoginAccount ? <ShieldCheck size={14} className="text-indigo-600" /> : <ShieldOff size={14} className="text-slate-400" />}
                      Create login account for this staff member
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {createLoginAccount
                        ? 'This staff member will receive a portal invitation email to set up their account and sign in.'
                        : 'This staff member will be recorded in the organization but will not be able to sign in to the portal.'}
                    </div>
                  </div>
                </label>

                {createLoginAccount && (
                  <div className="mt-3 pt-3 border-t border-indigo-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Login Email</label>
                      <input
                        type="text"
                        readOnly
                        value={email}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200 text-xs text-slate-500 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Invitation will be sent to the email above.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Portal Role *</label>
                      <select
                        value={assignedRoleName}
                        onChange={(e) => setAssignedRoleName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Staff">Staff</option>
                        <option value="Manager">Manager</option>
                        <option value="HR Manager">HR Manager</option>
                        <option value="Organization Admin">Organization Admin</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Portal Status Badge */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Portal Status after creation:</span>
                  {createLoginAccount ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Invitation Pending</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">No Account</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={loading}>
              <Save className="w-4 h-4 mr-1.5" />
              {loading ? 'Saving...' : staffToEdit ? 'Update Staff Member' : 'Save Staff Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
