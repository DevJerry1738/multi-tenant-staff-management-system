import React, { useState } from 'react';
import type { StaffProfile } from '@/types/database';
import { staffService } from '@/lib/staff/staffService';
import { Button } from '@/components/ui';
import { AlertTriangle, X } from 'lucide-react';

interface DeactivateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff: StaffProfile | null;
  orgId: string;
}

export const DeactivateStaffModal: React.FC<DeactivateStaffModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  staff,
  orgId,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !staff) return null;

  const isActive = staff.employment_status === 'active';

  const handleToggleStatus = async () => {
    setLoading(true);
    const res = await staffService.setStaffActiveStatus(staff.id, !isActive, orgId);
    setLoading(false);

    if (res.success) {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${isActive ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isActive ? `Deactivate ${staff.first_name} ${staff.last_name}?` : `Reactivate ${staff.first_name} ${staff.last_name}?`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {isActive
                ? 'Deactivating this staff member will exclude them from active directories and selectors. No records will be deleted.'
                : 'Reactivating will restore this employee to active directories and organization selectors.'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleToggleStatus}
              disabled={loading}
              className={isActive ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}
            >
              {loading ? 'Processing...' : isActive ? 'Deactivate Staff' : 'Reactivate Staff'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
