import React, { useEffect, useState } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { attendanceService } from '@/lib/attendance/attendanceService';
import { staffService } from '@/lib/staff/staffService';
import type { AttendanceCorrectionRequest, AttendanceRecord, StaffProfile } from '@/types/database';
import { AttendanceLayout } from './AttendanceLayout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { AlertCircle, Check, CheckCircle2, Clock3, X, XCircle } from 'lucide-react';

export const AttendanceCorrectionsPage: React.FC = () => {
  const { activeOrganization, activeRoles, currentStaffProfile } = useTenant();
  const isManager = activeRoles.some((role) => role.name === 'Manager');
  const orgId = activeOrganization?.id || '';
  const [requests, setRequests] = useState<AttendanceCorrectionRequest[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [requestList, staffResult] = await Promise.all([
        attendanceService.getCorrectionRequests(orgId),
        staffService.getStaffProfiles({ orgId, limit: 1000 }),
      ]);
      const attendanceResult = await attendanceService.getAttendanceHistory({ orgId, limit: 1000 });
      setRequests(requestList.filter((request) => request.status === 'pending'));
      setStaff(staffResult.data);
      setAttendanceRecords(attendanceResult.data);
    } catch {
      setError('Unable to load attendance correction requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [orgId]);

  const reviewRequest = async (request: AttendanceCorrectionRequest, decision: 'approved' | 'rejected') => {
    const reviewerMemberId = currentStaffProfile?.organization_member_id;
    if (!reviewerMemberId) {
      setReviewError('Your organization membership could not be resolved.');
      return;
    }

    setReviewingId(request.id);
    setReviewError(null);
    const result = await attendanceService.reviewAttendanceCorrection({
      requestId: request.id,
      orgId,
      reviewerMemberId,
      decision,
      reviewReason: decision === 'rejected' ? 'Rejected by attendance reviewer.' : undefined,
    });
    setReviewingId(null);

    if (result.error) {
      setReviewError(result.error);
      return;
    }
    await loadRequests();
  };

  const staffName = (attendanceRecordId: string) => {
    const attendanceRecord = attendanceRecords.find((item) => item.id === attendanceRecordId);
    const profile = staff.find((item) => item.id === attendanceRecord?.staff_id);
    return profile ? `${profile.first_name} ${profile.last_name}` : 'Staff member';
  };

  return (
    <AttendanceLayout>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Attendance governance</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Correction requests</h2>
          <p className="mt-1 text-sm text-slate-500">Review requested changes without losing the original attendance record.</p>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {reviewError && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4" /> {reviewError}
          </div>
        )}

        <Card className="overflow-hidden border-slate-200">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500" aria-live="polite">
                <Clock3 className="h-4 w-4 animate-pulse" /> Loading correction requests...
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-800">No attendance corrections require your attention.</p>
                <p className="text-xs text-slate-500">Approved and rejected requests remain available in the audit history.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((request) => {
                  const isReviewing = reviewingId === request.id;
                  return (
                    <article key={request.id} className="space-y-4 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{staffName(request.attendance_record_id)}</h3>
                            <Badge variant="warning" className="text-[10px]">Pending review</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Submitted {new Date(request.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          {!isManager ? (
                            <>
                              <Button size="sm" variant="outline" disabled={isReviewing} onClick={() => reviewRequest(request, 'rejected')}>
                                <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                              </Button>
                              <Button size="sm" disabled={isReviewing} onClick={() => reviewRequest(request, 'approved')}>
                                <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                              </Button>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Awaiting HR/Admin review</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-3">
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-slate-400">Original</div>
                          <div className="mt-1 text-slate-700">{request.original_clock_in || 'No clock-in'} to {request.original_clock_out || 'No clock-out'}</div>
                        </div>
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-slate-400">Requested</div>
                          <div className="mt-1 text-slate-700">{request.requested_clock_in || 'No clock-in'} to {request.requested_clock_out || 'No clock-out'}</div>
                        </div>
                        <div>
                          <div className="font-semibold uppercase tracking-wide text-slate-400">Location</div>
                          <div className="mt-1 capitalize text-slate-700">{request.requested_work_location || 'Unchanged'}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-slate-700">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span><strong>Reason:</strong> {request.reason}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AttendanceLayout>
  );
};
