import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
        <ShieldAlert className="w-8 h-8 text-rose-500" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-sm text-slate-500 max-w-md">
          You do not have the required permissions to access this page. Contact your organization administrator to request access.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
        <Button size="sm" onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>

      <p className="text-[11px] text-slate-400 font-mono">HTTP 403 Forbidden — Permission Check Failed</p>
    </div>
  );
};
