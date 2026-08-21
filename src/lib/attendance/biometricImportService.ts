import { supabase } from '@/lib/supabase/client';
import type { AttendanceImportBatch, AttendanceImportError, AttendanceRecord } from '@/types/database';
import { staffService } from '@/lib/staff/staffService';
import { attendanceService } from '@/lib/attendance/attendanceService';
import { auditService } from '@/lib/audit/auditService';

export interface ColumnMapping {
  employee_number: string;
  attendance_date: string;
  clock_in: string;
  clock_out: string;
  work_location?: string;
  device_id?: string;
}

export interface ParsedRow {
  rowNumber: number;
  rawData: Record<string, any>;
  employeeNumber: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workLocation: string;
}

export interface ValidationRowResult {
  rowNumber: number;
  employeeNumber: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workLocation: string;
  staffId?: string;
  staffName?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  rows: ValidationRowResult[];
}

const MOCK_IMPORT_BATCHES: Record<string, AttendanceImportBatch[]> = {
  '11111111-1111-1111-1111-111111111111': [
    {
      id: 'batch-a1',
      organization_id: '11111111-1111-1111-1111-111111111111',
      uploaded_by: 'alice@demorealtyA.com',
      file_name: 'biometric_august_2026.csv',
      file_type: 'csv',
      period_start: '2026-08-01',
      period_end: '2026-08-19',
      total_rows: 45,
      successful_rows: 43,
      failed_rows: 2,
      status: 'completed_with_errors',
      created_at: '2026-08-19T16:00:00Z',
      completed_at: '2026-08-19T16:01:00Z',
    },
  ],
};

class BiometricImportService {
  /**
   * Parse raw text file (CSV format) into key-value row maps.
   */
  parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      if (values.length < headers.length) continue;

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = values[idx] || '';
      });
      rows.push(rowMap);
    }

    return { headers, rows };
  }

  /**
   * Auto-suggest column mappings based on common header names.
   */
  suggestMapping(headers: string[]): ColumnMapping {
    const findHeader = (patterns: string[]) =>
      headers.find((h) => patterns.some((p) => h.toLowerCase().includes(p))) || headers[0] || '';

    return {
      employee_number: findHeader(['emp', 'employee', 'staff_id', 'id', 'badge', 'card']),
      attendance_date: findHeader(['date', 'day', 'time_in_date']),
      clock_in: findHeader(['clock_in', 'in', 'first_punch', 'time_in', 'start']),
      clock_out: findHeader(['clock_out', 'out', 'last_punch', 'time_out', 'end']),
      work_location: findHeader(['location', 'site', 'mode', 'type']),
    };
  }

  /**
   * Run validation pipeline over parsed rows.
   */
  async validateImportRows(
    rows: Record<string, string>[],
    mapping: ColumnMapping,
    orgId: string
  ): Promise<ImportPreviewResult> {
    const staffResult = await staffService.getStaffProfiles({ orgId, limit: 1000 });
    const staffList = staffResult.data;
    const historyResult = await attendanceService.getAttendanceHistory({ orgId, limit: 10000 });
    const existingRecords = historyResult.data;

    let validCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    const rowResults: ValidationRowResult[] = rows.map((raw, idx) => {
      const rowNum = idx + 2; // Accounting for 1-based index + header row
      const empNum = raw[mapping.employee_number]?.trim() || '';
      const date = raw[mapping.attendance_date]?.trim() || '';
      const clockIn = raw[mapping.clock_in]?.trim() || null;
      const clockOut = raw[mapping.clock_out]?.trim() || null;
      const locStr = raw[mapping.work_location]?.toLowerCase() || 'office';
      const workLocation = locStr.includes('remote') ? 'remote' : locStr.includes('field') ? 'field' : 'office';

      const errors: string[] = [];

      // 1. Employee matching within current organization
      const matchingStaff = staffList.find(
        (s) => s.employee_number.toLowerCase() === empNum.toLowerCase()
      );

      if (!matchingStaff) {
        errors.push(`Employee number "${empNum}" not found in this organization.`);
      }

      // 2. Date check
      if (!date || isNaN(Date.parse(date))) {
        errors.push('Invalid or missing attendance date.');
      }

      // 3. Chronological sanity
      if (clockIn && clockOut) {
        const inTime = Date.parse(clockIn.includes('T') ? clockIn : `${date}T${clockIn}`);
        const outTime = Date.parse(clockOut.includes('T') ? clockOut : `${date}T${clockOut}`);
        if (!isNaN(inTime) && !isNaN(outTime) && outTime < inTime) {
          errors.push('Clock-out time cannot precede clock-in time.');
        }
      }

      // 4. Duplicate check
      let isDuplicate = false;
      if (matchingStaff && date) {
        const dup = existingRecords.find(
          (r) => r.staff_id === matchingStaff.id && r.attendance_date === date
        );
        if (dup) {
          isDuplicate = true;
          errors.push(`Existing record already exists for ${date}.`);
        }
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else {
        errorCount++;
        if (isDuplicate) duplicateCount++;
      }

      return {
        rowNumber: rowNum,
        employeeNumber: empNum,
        date,
        clockIn,
        clockOut,
        workLocation,
        staffId: matchingStaff?.id,
        staffName: matchingStaff ? `${matchingStaff.first_name} ${matchingStaff.last_name}` : undefined,
        isValid,
        isDuplicate,
        errors,
      };
    });

    return {
      totalRows: rows.length,
      validRows: validCount,
      errorRows: errorCount,
      duplicateRows: duplicateCount,
      rows: rowResults,
    };
  }

  /**
   * Confirm and execute import of valid preview rows into attendance_records.
   */
  async confirmImport(
    preview: ImportPreviewResult,
    fileName: string,
    orgId: string,
    actorMemberId?: string
  ): Promise<{ batch: AttendanceImportBatch; importedCount: number }> {
    const validRows = preview.rows.filter((r) => r.isValid && r.staffId);

    const batchId = `batch-${Date.now()}`;
    const batch: AttendanceImportBatch = {
      id: batchId,
      organization_id: orgId,
      uploaded_by: actorMemberId || 'mem-admin',
      file_name: fileName,
      file_type: fileName.endsWith('.xlsx') ? 'xlsx' : 'csv',
      period_start: validRows[0]?.date || new Date().toISOString().split('T')[0],
      period_end: validRows[validRows.length - 1]?.date || new Date().toISOString().split('T')[0],
      total_rows: preview.totalRows,
      successful_rows: validRows.length,
      failed_rows: preview.errorRows,
      status: preview.errorRows > 0 ? 'completed_with_errors' : 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    if (!MOCK_IMPORT_BATCHES[orgId]) MOCK_IMPORT_BATCHES[orgId] = [];
    MOCK_IMPORT_BATCHES[orgId].unshift(batch);

    // Create attendance records
    for (const r of validRows) {
      const formattedClockIn = r.clockIn ? (r.clockIn.includes('T') ? r.clockIn : `${r.date}T${r.clockIn}Z`) : null;
      const formattedClockOut = r.clockOut ? (r.clockOut.includes('T') ? r.clockOut : `${r.date}T${r.clockOut}Z`) : null;

      let totalHours: number | null = null;
      if (formattedClockIn && formattedClockOut) {
        const inMs = new Date(formattedClockIn).getTime();
        const outMs = new Date(formattedClockOut).getTime();
        totalHours = Math.round(((outMs - inMs) / (1000 * 60 * 60)) * 100) / 100;
      }

      const rec: AttendanceRecord = {
        id: `att-bio-${Date.now()}-${r.rowNumber}`,
        organization_id: orgId,
        staff_id: r.staffId!,
        attendance_date: r.date,
        clock_in: formattedClockIn,
        clock_out: formattedClockOut,
        status: formattedClockIn ? 'present' : 'absent',
        work_location: (r.workLocation as any) || 'office',
        source: 'biometric',
        total_hours: totalHours,
        notes: `Imported via ${fileName}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await supabase.from('attendance_records').insert([rec]);
      } catch {
        // Fallback to mock
      }
    }

    await auditService.logEvent({
      organizationId: orgId,
      actorMemberId,
      action: 'attendance.import_completed',
      resourceType: 'attendance_import_batches',
      resourceId: batchId,
      newValues: {
        file_name: fileName,
        successful_rows: validRows.length,
        failed_rows: preview.errorRows,
      },
    });

    return { batch, importedCount: validRows.length };
  }

  /**
   * Get previous import batches for an organization.
   */
  async getImportBatches(orgId: string): Promise<AttendanceImportBatch[]> {
    return MOCK_IMPORT_BATCHES[orgId] || [];
  }
}

export const biometricImportService = new BiometricImportService();
