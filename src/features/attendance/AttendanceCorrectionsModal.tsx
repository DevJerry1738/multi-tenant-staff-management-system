import React, { useState, useEffect } from 'react';
import type { AttendanceRecord, WorkLocation } from '@/types/database';
import { attendanceService } from '@/lib/attendance/attendanceService';
import { Button } from '@/components/ui';
import { X, Save, AlertCircle, Clock } from 'lucide-react';

interface AttendanceCorrectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: AttendanceRecord | null;
  orgId: string;
}

export const AttendanceCorrectionsModal: React.FC<AttendanceCorrectionsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  record,
  orgId,
}) => {
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [workLocation, setWorkLocation] = useState<WorkLocation>('office');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      // Format to datetime-local string
      setClockIn(record.clock_in ? new Date(record.clock_in).toISOString().slice(0, 16) : '');
      setClockOut(record.clock_out ? new Date(record.clock_out).toISOString().slice(0, 16) : '');
      setWorkLocation(record.work_location || 'office');
      setReason('');
      setError(null);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('A mandatory correction reason must be provided for audit compliance.');
      return;
    }

    setLoading(true);

    const res = await attendanceService.correctAttendance({
      recordId: record.id,
      newClockIn: clockIn ? new Date(clockIn).toISOString() : null,
      newClockOut: clockOut ? new Date(clockOut).toISOString() : null,
      workLocation,
      reason: reason.trim(),
      orgId,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Correct Attendance Record</h2>
              <p className="text-xs text-slate-500">Date: {record.attendance_date}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Original Values Display */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original Recorded Punches</div>
            <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono">
              <div>In: {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : 'None'}</div>
              <div>Out: {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : 'None'}</div>
            </div>
          </div>

          {/* New Timestamps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Clock In</label>
              <input
                type="datetime-local"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Clock Out</label>
              <input
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Work Location</label>
            <select
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value as WorkLocation)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
            >
              <option value="office">Office</option>
              <option value="remote">Remote</option>
              <option value="field">Field</option>
            </select>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Correction Reason *
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. System glitch during clock-out, HR manual correction approved by manager..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              <Save size={14} className="mr-1.5" /> Save Correction
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
