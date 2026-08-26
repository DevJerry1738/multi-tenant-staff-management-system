import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { organizationService } from '@/lib/organizations/organizationService';
import type { OrganizationInvitation } from '@/types/database';
import { MOCK_ORGANIZATIONS } from '@/lib/tenant/mockData';
import { CheckCircle2, AlertCircle, Eye, EyeOff, Lock, Mail, Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';

type PageState = 'loading' | 'form' | 'success' | 'invalid' | 'expired';

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null);
  const [orgName, setOrgName] = useState<string>('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    organizationService.getInvitationByToken(token).then((inv) => {
      if (!inv) {
        setPageState('invalid');
        return;
      }

      if (new Date(inv.expires_at) < new Date()) {
        setPageState('expired');
        return;
      }

      setInvitation(inv);
      organizationService.getOrganizationById(inv.organization_id).then((org) => {
        setOrgName(org?.name || 'Your Organization');
        setPageState('form');
      }).catch(() => {
        setOrgName('Your Organization');
        setPageState('form');
      });
    });
  }, [token]);

  const validatePassword = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const err = validatePassword();
    if (err) { setFormError(err); return; }

    setIsSubmitting(true);

    const result = await organizationService.acceptInvitation(token, password);

    if (!result.success) {
      setFormError(result.error || 'Failed to complete account setup. Please try again.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setPageState('success');
  };

  const getPasswordStrength = (): { label: string; color: string; width: string } => {
    if (password.length === 0) return { label: '', color: '', width: '0%' };
    const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^a-zA-Z0-9]/.test(password), password.length >= 12].filter(Boolean).length;
    if (score <= 2) return { label: 'Weak', color: 'bg-rose-500', width: '30%' };
    if (score === 3) return { label: 'Fair', color: 'bg-amber-400', width: '60%' };
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl mx-auto shadow-xl shadow-indigo-900/50">
            MT
          </div>
          <div className="text-white font-bold text-lg mt-3">Staff Management Platform</div>
          <div className="text-indigo-300 text-xs font-medium mt-0.5">Secure Organization Access</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* ── Loading ── */}
          {pageState === 'loading' && (
            <div className="p-10 text-center">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-sm text-slate-600 font-semibold">Verifying invitation…</div>
            </div>
          )}

          {/* ── Invalid Token ── */}
          {(pageState === 'invalid' || pageState === 'expired') && (
            <div className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
                <AlertCircle size={28} className="text-rose-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {pageState === 'expired' ? 'Invitation Expired' : 'Invalid Invitation Link'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {pageState === 'expired'
                    ? 'This invitation link has expired. Please contact your organization administrator to request a new invitation.'
                    : 'This invitation link is invalid or has already been used. Please contact your administrator.'}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          )}

          {/* ── Account Setup Form ── */}
          {pageState === 'form' && invitation && (
            <form onSubmit={handleAccept} className="space-y-0">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 bg-indigo-600">
                <div className="flex items-center gap-2 text-indigo-100 text-xs font-semibold mb-1">
                  <Building2 size={12} /> {orgName}
                </div>
                <h2 className="text-lg font-extrabold text-white">Complete Your Account Setup</h2>
                <p className="text-indigo-200 text-xs mt-0.5">You've been invited as <strong className="text-white">{invitation.role_name}</strong>. Set your password to get started.</p>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Email (read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 font-semibold">{invitation.email}</span>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 flex items-start gap-2 text-xs text-rose-700">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" /> {formError}
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full pl-8 pr-10 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {/* Strength Bar */}
                  {password.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">{strength.label} password</div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Minimum 8 characters, including uppercase and a number.</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full pl-8 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-rose-500 mt-1 font-semibold">Passwords do not match</p>
                  )}
                </div>

                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white" size="sm" disabled={isSubmitting}>
                  <ShieldCheck size={15} className="mr-1.5" />
                  {isSubmitting ? 'Activating Account…' : 'Activate Account & Sign In'}
                </Button>
              </div>
            </form>
          )}

          {/* ── Success ── */}
          {pageState === 'success' && (
            <div className="p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Account Activated!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Your account has been set up successfully. You can now sign in to {orgName}.
                </p>
              </div>
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white w-full"
                size="sm"
                onClick={async () => {
                  const { supabase } = await import('@/lib/supabase/client');
                  await supabase.auth.signOut().catch(() => null);
                  navigate('/login');
                }}
              >
                Go to Login
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-indigo-300/60 mt-6">
          Multi-Tenant Staff Management Platform · Secure Portal Access
        </p>
      </div>
    </div>
  );
};
