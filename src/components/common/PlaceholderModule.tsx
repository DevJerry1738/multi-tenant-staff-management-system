import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import { useTenant } from '@/lib/tenant/TenantContext';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface PlaceholderModuleProps {
  title: string;
  description: string;
  sprintTarget: string;
  tablesPrepared: string[];
}

export const PlaceholderModule: React.FC<PlaceholderModuleProps> = ({
  title,
  description,
  sprintTarget,
  tablesPrepared,
}) => {
  const { activeOrganization } = useTenant();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              Sprint 0 Foundation Ready
            </Badge>
            <span className="text-xs text-slate-500">• {activeOrganization?.name} Context</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>

        <Badge variant="secondary" className="self-start sm:self-center py-1 px-3 text-xs flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-600" /> Scheduled for {sprintTarget}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-sm">Database Tables & Schema Established</CardTitle>
            </div>
            <CardDescription>All underlying storage structures and RLS policies are active</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tablesPrepared.map((table) => (
                <li key={table} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100 font-mono">
                  <span>{table}</span>
                  <Badge variant="success" className="text-[10px]">RLS Protected</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-sm">Sprint Scope Boundary</CardTitle>
            </div>
            <CardDescription>Sprint 0 architectural rule</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-3">
            <p>
              As per Sprint 0 specifications, deep workflows for this module are intentionally deferred to prevent premature feature implementation before core foundation sign-off.
            </p>
            <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 text-indigo-900 font-medium">
              Ready for immediate feature expansion in {sprintTarget}.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
