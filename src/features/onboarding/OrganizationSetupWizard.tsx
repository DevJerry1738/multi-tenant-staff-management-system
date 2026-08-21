import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  organizationService,
  MOCK_INVITATIONS,
} from '@/lib/organizations/organizationService';
import type { CreateOrganizationInput } from '@/lib/organizations/organizationService';
import type { AttendanceMethod, OrganizationInvitation } from '@/types/database';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  Building2,
  Settings,
  UserPlus,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Globe,
  Clock,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface OrgInfoForm {
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  timezone: string;
}

interface OrgSettingsForm {
  attendance_method: AttendanceMethod;
  default_work_start: string;
  default_work_end: string;
}

interface AdminForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Lagos', 'Africa/Nairobi',
];

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand',
  'South Africa', 'Nigeria', 'Kenya', 'United Arab Emirates', 'Singapore',
  'Germany', 'France', 'Netherlands', 'India', 'Japan',
];

const STEPS = [
  { num: 1 as WizardStep, label: 'Organization', icon: Building2 },
  { num: 2 as WizardStep, label: 'Settings',     icon: Settings },
  { num: 3 as WizardStep, label: 'Admin',         icon: UserPlus },
  { num: 4 as WizardStep, label: 'Review',        icon: ClipboardCheck },
  { num: 5 as WizardStep, label: 'Complete',      icon: CheckCircle2 },
];

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const OrganizationSetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null);

  const [orgInfo, setOrgInfo] = useState<OrgInfoForm>({
    name: '', legal_name: '', email: '', phone: '',
    website: '', country: 'United States', timezone: 'America/New_York',
  });

  const [orgSettings, setOrgSettings] = useState<OrgSettingsForm>({
    attendance_method: 'platform_clocking',
    default_work_start: '09:00',
    default_work_end: '17:00',
  });

  const [adminForm, setAdminForm] = useState<AdminForm>({
    first_name: '', last_name: '', email: '', password: '', confirm_password: '',
  });

  // ── Step Validation ──────────────────────────────────────────────────────
  const validateStep = (): string | null => {
    if (step === 1) {
      if (!orgInfo.name.trim()) return 'Organization Name is required.';
      if (!orgInfo.email.trim() || !orgInfo.email.includes('@')) return 'A valid Organization Email is required.';
      if (!orgInfo.country) return 'Country is required.';
      if (!orgInfo.timezone) return 'Timezone is required.';
    }
    if (step === 3) {
      if (!adminForm.first_name.trim()) return 'Admin First Name is required.';
      if (!adminForm.last_name.trim()) return 'Admin Last Name is required.';
      if (!adminForm.email.trim() || !adminForm.email.includes('@')) return 'A valid Admin Email is required.';
      if (adminForm.password.length < 8) return 'Admin password must be at least 8 characters.';
      if (adminForm.password !== adminForm.confirm_password) return 'Admin passwords do not match.';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setStep((s) => Math.min(s + 1, 5) as WizardStep);
  };

  const handleBack = () => {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 1) as WizardStep);
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setFormError(null);

    const input: CreateOrganizationInput = {
      name: orgInfo.name.trim(),
      legal_name: orgInfo.legal_name.trim() || undefined,
      slug: slugify(orgInfo.name.trim()),
      email: orgInfo.email.trim(),
      phone: orgInfo.phone.trim() || undefined,
      website: orgInfo.website.trim() || undefined,
      country: orgInfo.country,
      timezone: orgInfo.timezone,
      admin_first_name: adminForm.first_name.trim(),
      admin_last_name: adminForm.last_name.trim(),
      admin_email: adminForm.email.trim(),
      admin_password: adminForm.password,
      attendance_method: orgSettings.attendance_method,
      default_work_start: orgSettings.default_work_start,
      default_work_end: orgSettings.default_work_end,
    };

    const { data: org, error: createErr } = await organizationService.createOrganization(input, user?.id);
    if (createErr || !org) {
      setFormError(createErr || 'Failed to create organization. Please try again.');
      setIsSubmitting(false);
      return;
    }

    if (isSupabaseConfigured) {
      const { error: sessionError } = await supabase.auth.signInWithPassword({
        email: adminForm.email.trim(),
        password: adminForm.password,
      });
      if (sessionError) {
        setFormError('Organization created. Sign in with the administrator email and password to continue.');
        setIsSubmitting(false);
        return;
      }
    }

    let inv: OrganizationInvitation | undefined;
    if (!isSupabaseConfigured) {
      const setupResult = await organizationService.completeOrganizationSetup(
        org.id,
        {
          timezone: orgInfo.timezone,
          attendance_method: orgSettings.attendance_method,
          default_work_start: orgSettings.default_work_start,
          default_work_end: orgSettings.default_work_end,
          admin_first_name: adminForm.first_name.trim(),
          admin_last_name: adminForm.last_name.trim(),
          admin_email: adminForm.email.trim(),
        },
        user?.id
      );
      if (!setupResult.success || setupResult.error) {
        setFormError(setupResult.error || 'Organization setup could not be completed.');
        setIsSubmitting(false);
        return;
      }
      inv = setupResult.invitation;
    }

    setCreatedOrgId(org.id);
    setInvitation(inv || null);
    setIsSubmitting(false);
    setStep(5);
  };

  // ── Progress Indicator ───────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const isDone = step > s.num;
        const isActive = step === s.num;
        return (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                isDone ? 'bg-indigo-600 border-indigo-600 text-white' :
                isActive ? 'bg-white border-indigo-600 text-indigo-600' :
                'bg-white border-slate-200 text-slate-300'
              }`}>
                {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-indigo-600' : isDone ? 'text-slate-600' : 'text-slate-300'}`}>
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-16 mx-1 mb-4 transition-colors ${step > s.num ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const inputCls = "w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-3 shadow-lg">
            MT
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Provision New Organization</h1>
          <p className="text-sm text-slate-500 mt-1">Set up a new tenant organization and invite the initial administrator.</p>
        </div>

        <StepIndicator />

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {formError && (
            <div className="mx-6 mt-5 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          <div className="px-6 py-6 space-y-5">
            {/* ── STEP 1: Organization Information ── */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 1 of 4 — Organization Information</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Enter the basic details for this organization.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Organization Name *</label>
                    <input className={inputCls} value={orgInfo.name} onChange={(e) => setOrgInfo({ ...orgInfo, name: e.target.value, })} placeholder="e.g. Acme Realty Corp" />
                    {orgInfo.name && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Identifier: {slugify(orgInfo.name)}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Legal Name</label>
                    <input className={inputCls} value={orgInfo.legal_name} onChange={(e) => setOrgInfo({ ...orgInfo, legal_name: e.target.value })} placeholder="Official registered legal name (optional)" />
                  </div>
                  <div>
                    <label className={labelCls}>Organization Email *</label>
                    <input type="email" className={inputCls} value={orgInfo.email} onChange={(e) => setOrgInfo({ ...orgInfo, email: e.target.value })} placeholder="contact@acmerealty.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input type="tel" className={inputCls} value={orgInfo.phone} onChange={(e) => setOrgInfo({ ...orgInfo, phone: e.target.value })} placeholder="+1-555-0100" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Website</label>
                    <input className={inputCls} value={orgInfo.website} onChange={(e) => setOrgInfo({ ...orgInfo, website: e.target.value })} placeholder="https://acmerealty.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Country *</label>
                    <select className={inputCls} value={orgInfo.country} onChange={(e) => setOrgInfo({ ...orgInfo, country: e.target.value })}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Timezone *</label>
                    <select className={inputCls} value={orgInfo.timezone} onChange={(e) => setOrgInfo({ ...orgInfo, timezone: e.target.value })}>
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 2: Organization Settings ── */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 2 of 4 — Organization Settings</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Configure attendance method and standard working hours.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Attendance Collection Method *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {[
                        { value: 'platform_clocking' as AttendanceMethod, label: 'Platform Clocking', desc: 'Staff clock in/out via the web portal.' },
                        { value: 'biometric_import' as AttendanceMethod, label: 'Biometric Import', desc: 'Upload biometric device export files (CSV/XLSX).' },
                      ].map((opt) => (
                        <label key={opt.value} className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${orgSettings.attendance_method === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                          <input type="radio" name="attendance_method" value={opt.value} checked={orgSettings.attendance_method === opt.value} onChange={() => setOrgSettings({ ...orgSettings, attendance_method: opt.value })} className="mt-0.5 text-indigo-600" />
                          <div>
                            <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Default Work Start</label>
                      <input type="time" className={inputCls} value={orgSettings.default_work_start} onChange={(e) => setOrgSettings({ ...orgSettings, default_work_start: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Default Work End</label>
                      <input type="time" className={inputCls} value={orgSettings.default_work_end} onChange={(e) => setOrgSettings({ ...orgSettings, default_work_end: e.target.value })} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: Initial Admin ── */}
            {step === 3 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 3 of 4 — Initial Organization Administrator</h2>
                  <p className="text-xs text-slate-500 mt-0.5">This person will receive an invitation to set up their account and manage this organization.</p>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-800 flex items-start gap-2">
                  <Mail size={14} className="shrink-0 mt-0.5 text-indigo-600" />
                  An invitation link will be sent to the admin email after the organization is created. They will be able to set their password on first login.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>First Name *</label>
                    <input className={inputCls} value={adminForm.first_name} onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })} placeholder="Jane" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name *</label>
                    <input className={inputCls} value={adminForm.last_name} onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })} placeholder="Smith" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Admin Email *</label>
                    <input type="email" className={inputCls} value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="admin@acmerealty.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Password *</label>
                    <input type="password" minLength={8} className={inputCls} value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} autoComplete="new-password" />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password *</label>
                    <input type="password" minLength={8} className={inputCls} value={adminForm.confirm_password} onChange={(e) => setAdminForm({ ...adminForm, confirm_password: e.target.value })} autoComplete="new-password" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <div className="font-bold text-slate-700 mb-1">Role Assignment</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[11px]">Organization Admin</span>
                    <span className="text-slate-400">— Full access to this organization's management portal</span>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 4: Review ── */}
            {step === 4 && (
              <>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 4 of 4 — Review & Confirm</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Review the details before creating the organization.</p>
                </div>

                <div className="space-y-3">
                  {/* Organization Block */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Building2 size={12} /> Organization
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <ReviewRow label="Name" value={orgInfo.name} />
                      {orgInfo.legal_name && <ReviewRow label="Legal Name" value={orgInfo.legal_name} />}
                      <ReviewRow label="Email" value={orgInfo.email} />
                      {orgInfo.phone && <ReviewRow label="Phone" value={orgInfo.phone} />}
                      <ReviewRow label="Country" value={orgInfo.country} />
                      <ReviewRow label="Timezone" value={orgInfo.timezone} />
                      <ReviewRow label="Identifier (slug)" value={slugify(orgInfo.name)} mono />
                    </div>
                  </div>

                  {/* Settings Block */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Settings size={12} /> Settings
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <ReviewRow label="Attendance Method" value={orgSettings.attendance_method === 'platform_clocking' ? 'Platform Clocking' : 'Biometric Import'} />
                      <ReviewRow label="Work Hours" value={`${orgSettings.default_work_start} – ${orgSettings.default_work_end}`} />
                    </div>
                  </div>

                  {/* Admin Block */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <UserPlus size={12} /> Initial Administrator
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <ReviewRow label="Name" value={`${adminForm.first_name} ${adminForm.last_name}`} />
                      <ReviewRow label="Email" value={adminForm.email} />
                      <ReviewRow label="Role" value="Organization Admin" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 5: Complete ── */}
            {step === 5 && (
              <div className="text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Organization Created!</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    <strong>{orgInfo.name}</strong> has been provisioned and setup is complete.
                  </p>
                </div>

                {invitation && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-left space-y-2">
                    <div className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                      <Mail size={13} /> Invitation Created
                    </div>
                    <p className="text-xs text-indigo-700">
                      An invitation has been generated for <strong>{invitation.email}</strong> as <strong>{invitation.role_name}</strong>.
                    </p>

                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button
                    onClick={() => navigate('/organizations')}
                    variant="outline"
                    size="sm"
                  >
                    Back to Organizations
                  </Button>
                  <Button
                    onClick={() => navigate(createdOrgId ? `/organizations/${createdOrgId}/setup` : '/organizations')}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    size="sm"
                  >
                    View Organization
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Nav */}
          {step < 5 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {step > 1 ? (
                <Button variant="outline" size="sm" onClick={handleBack} disabled={isSubmitting}>
                  <ChevronLeft size={14} className="mr-1" /> Back
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/organizations')}>
                  Cancel
                </Button>
              )}

              {step < 4 && (
                <Button onClick={handleNext} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  Continue <ChevronRight size={14} className="ml-1" />
                </Button>
              )}

              {step === 4 && (
                <Button onClick={handleCreate} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create Organization & Send Invitation'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper
const ReviewRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <>
    <div className="text-slate-400 font-semibold">{label}</div>
    <div className={`text-slate-900 font-semibold ${mono ? 'font-mono' : ''}`}>{value}</div>
  </>
);
