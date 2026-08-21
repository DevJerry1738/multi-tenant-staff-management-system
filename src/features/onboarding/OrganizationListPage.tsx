import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationService } from '@/lib/organizations/organizationService';
import type { Organization } from '@/types/database';
import {
  Building2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Users,
  Settings,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';

export const OrganizationListPage: React.FC = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    organizationService.getOrganizations().then((orgs) => {
      setOrganizations(orgs);
      setLoading(false);
    });
  }, []);

  const setupComplete = (org: Organization) => !!org.setup_completed_at;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <Building2 size={12} />
            Platform Administration
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Organizations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Provision and manage tenant organizations on this platform.</p>
        </div>
        <Button
          onClick={() => navigate('/organizations/new')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2"
          size="sm"
        >
          <Plus size={15} /> Provision New Organization
        </Button>
      </div>

      {/* Platform Admin Warning Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 font-medium flex items-start gap-2">
        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>Platform Administration Area.</strong> Actions here affect entire tenant organizations. Organization admins do not have access to this section.
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Organizations', value: organizations.length, color: 'text-indigo-600' },
          { label: 'Active', value: organizations.filter(o => o.status === 'active').length, color: 'text-emerald-600' },
          { label: 'Setup Complete', value: organizations.filter(o => o.setup_completed_at).length, color: 'text-blue-600' },
          { label: 'Suspended', value: organizations.filter(o => o.status === 'suspended').length, color: 'text-rose-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 font-semibold mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Organizations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">All Organizations</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading organizations…</div>
        ) : organizations.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 size={40} className="mx-auto text-slate-200 mb-3" />
            <div className="text-sm font-semibold text-slate-400">No organizations provisioned yet.</div>
            <div className="text-xs text-slate-400 mt-1">Click "Provision New Organization" to get started.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/organizations/${org.id}/setup`)}
              >
                <div className="flex items-center gap-4">
                  {/* Org Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{org.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{org.slug}</span>
                      {org.country && <><span>·</span><span>{org.country}</span></>}
                      {org.timezone && <><span>·</span><span>{org.timezone}</span></>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Setup Status */}
                  {setupComplete(org) ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Setup Complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <Clock size={10} /> Setup Pending
                    </span>
                  )}

                  {/* Status Badge */}
                  <Badge
                    variant={org.status === 'active' ? 'default' : 'secondary'}
                    className={`text-[10px] capitalize ${org.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}
                  >
                    {org.status}
                  </Badge>

                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
