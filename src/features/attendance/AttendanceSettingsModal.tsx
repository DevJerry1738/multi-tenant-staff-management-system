import React, { useState, useEffect } from 'react';
import { attendanceService } from '@/lib/attendance/attendanceService';
import type { OrganizationSettings, AttendanceMethod } from '@/types/database';
import { Button } from '@/components/ui';
import { X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AttendanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSettings: Partial<OrganizationSettings>;
  orgId: string;
}

export const AttendanceSettingsModal: React.FC<AttendanceSettingsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSettings,
  orgId,
}) => {
  const [method, setMethod] = useState<AttendanceMethod>('platform_clocking');
  const [allowRemote, setAllowRemote] = useState(true);
  const [allowField, setAllowField] = useState(true);
  const [requireClockOut, setRequireClockOut] = useState(true);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMethod(currentSettings.attendance_method || 'platform_clocking');
      setAllowRemote(currentSettings.allow_remote !== false);
      setAllowField(currentSettings.allow_field !== false);
      setRequireClockOut(currentSettings.require_clock_out !== false);
      setWorkStart(currentSettings.default_work_start || '09:00');
      setWorkEnd(currentSettings.default_work_end || '17:00');
      setShowWarning(false);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if switching method
    if (method !== (currentSettings.attendance_method || 'platform_clocking') && !showWarning) {
      setShowWarning(true);
      return;
    }

    setLoading(true);
    await attendanceService.updateAttendanceSettings(orgId, {
      attendance_method: method,
      allow_remote: allowRemote,
      allow_field: allowField,
      require_clock_out: requireClockOut,
      default_work_start: workStart,
      default_work_end: workEnd,
    });
    setLoading(false);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Organization Attendance Configuration</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 text-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {showWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                Confirm Attendance Method Switch
              </div>
              <p>
                Switching from <strong>{currentSettings.attendance_method === 'biometric_import' ? 'Biometric Import' : 'Platform Clocking'}</strong> to{' '}
                <strong>{method === 'biometric_import' ? 'Biometric Import' : 'Platform Clocking'}</strong> will alter how employees log time. Historical records will be preserved without modification.
              </p>
            </div>
          )}

          {/* Collection Method Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
              1. Attendance Collection Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setMethod('platform_clocking'); setShowWarning(false); }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  method === 'platform_clocking'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Platform Clocking</span>
                  {method === 'platform_clocking' && <CheckCircle2 size={16} className="text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Employees clock in/out via web application.</p>
              </button>

              <button
                type="button"
                onClick={() => { setMethod('biometric_import'); setShowWarning(false); }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  method === 'biometric_import'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Biometric Import</span>
                  {method === 'biometric_import' && <CheckCircle2 size={16} className="text-indigo-600" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">HR uploads monthly/periodic CSV/XLSX biometric files.</p>
              </button>
            </div>
          </div>

          {/* Work Hours & Tolerances */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
              2. Standard Operating Hours
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Work Start</label>
                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Work End</label>
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Work Location Options */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
              3. Permitted Work Locations
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRemote}
                  onChange={(e) => setAllowRemote(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800">Allow Remote Work Clock-in</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowField}
                  onChange={(e) => setAllowField(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800">Allow Field/Site Work Clock-in</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireClockOut}
                  onChange={(e) => setRequireClockOut(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800">Require Explicit Clock-Out to Compute Hours</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              <Save size={14} className="mr-1.5" /> {showWarning ? 'Confirm & Save' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
