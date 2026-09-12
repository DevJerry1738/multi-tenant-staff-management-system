-- Transactional correction review boundary.
-- The reviewer is derived from auth.uid(); the browser cannot impersonate a member.

CREATE OR REPLACE FUNCTION public.review_attendance_correction(
  p_request_id UUID,
  p_decision TEXT,
  p_review_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.attendance_correction_requests%ROWTYPE;
  reviewer_member_id UUID;
  new_total_hours NUMERIC(6,2);
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid correction decision';
  END IF;

  SELECT *
  INTO request_row
  FROM public.attendance_correction_requests
  WHERE id = p_request_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction request not found or already reviewed';
  END IF;

  IF NOT public.user_has_org_permission(request_row.organization_id, 'attendance.manage') THEN
    RAISE EXCEPTION 'You are not authorized to review attendance corrections';
  END IF;

  reviewer_member_id := public.current_org_member_id(request_row.organization_id);
  IF reviewer_member_id IS NULL THEN
    RAISE EXCEPTION 'Active organization membership required';
  END IF;

  IF p_decision = 'approved' THEN
    IF request_row.requested_clock_in IS NOT NULL
       AND request_row.requested_clock_out IS NOT NULL THEN
      new_total_hours := ROUND(
        EXTRACT(EPOCH FROM (request_row.requested_clock_out - request_row.requested_clock_in)) / 3600,
        2
      );
      IF new_total_hours < 0 THEN
        RAISE EXCEPTION 'Clock-out time cannot precede clock-in time';
      END IF;
    ELSE
      new_total_hours := NULL;
    END IF;

    UPDATE public.attendance_records
    SET original_clock_in = COALESCE(original_clock_in, clock_in),
        original_clock_out = COALESCE(original_clock_out, clock_out),
        clock_in = request_row.requested_clock_in,
        clock_out = request_row.requested_clock_out,
        work_location = COALESCE(request_row.requested_work_location, work_location),
        work_mode = COALESCE(request_row.requested_work_location, work_mode),
        total_hours = new_total_hours,
        source = 'correction',
        correction_reason = request_row.reason,
        corrected_by = auth.uid(),
        corrected_at = NOW(),
        updated_at = NOW()
    WHERE id = request_row.attendance_record_id
      AND organization_id = request_row.organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Attendance record not found';
    END IF;
  END IF;

  UPDATE public.attendance_correction_requests
  SET status = p_decision,
      reviewed_by_member_id = reviewer_member_id,
      review_reason = NULLIF(trim(COALESCE(p_review_reason, '')), ''),
      reviewed_at = NOW()
  WHERE id = request_row.id;

  INSERT INTO public.audit_logs (
    organization_id,
    actor_user_id,
    actor_member_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) VALUES (
    request_row.organization_id,
    auth.uid(),
    reviewer_member_id,
    CASE WHEN p_decision = 'approved'
      THEN 'attendance.correction_approved'
      ELSE 'attendance.correction_rejected'
    END,
    'attendance_correction_requests',
    request_row.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', p_decision, 'review_reason', NULLIF(trim(COALESCE(p_review_reason, '')), ''))
  );

  RETURN request_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_attendance_correction(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_attendance_correction(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.review_attendance_correction(UUID, TEXT, TEXT) IS
  'Atomically approves or rejects an attendance correction after deriving and authorizing the reviewer from auth.uid().';
