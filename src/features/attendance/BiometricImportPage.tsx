import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant/TenantContext';
import { biometricImportService } from '@/lib/attendance/biometricImportService';
import type {
  ColumnMapping,
  ImportPreviewResult,
} from '@/lib/attendance/biometricImportService';
import type { AttendanceImportBatch } from '@/types/database';
import { AttendanceLayout } from './AttendanceLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  History,
  Check,
} from 'lucide-react';

export const BiometricImportPage: React.FC = () => {
  const { activeOrganization } = useTenant();
  const orgId = activeOrganization?.id || '';

  // Wizard Steps: 1 = Upload, 2 = Mapping, 3 = Validation & Preview, 4 = Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File state
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);

  // Mapping & Validation state
  const [mapping, setMapping] = useState<ColumnMapping>({
    employee_number: '',
    attendance_date: '',
    clock_in: '',
    clock_out: '',
    work_location: '',
  });

  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [batches, setBatches] = useState<AttendanceImportBatch[]>([]);

  const loadBatches = async () => {
    if (!orgId) return;
    const list = await biometricImportService.getImportBatches(orgId);
    setBatches(list);
  };

  useEffect(() => {
    loadBatches();
  }, [orgId]);

  // Handle file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const parsed = biometricImportService.parseCSV(content);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);

      const autoMapping = biometricImportService.suggestMapping(parsed.headers);
      setMapping(autoMapping);
      setStep(2);
    };
    reader.readAsText(file);
  };

  // Demo file loader
  const loadDemoFile = () => {
    const demoCsv = `Employee Number,Date,Clock In,Clock Out,Location
EMP-A001,2026-08-20,08:55:00,17:02:00,Office
EMP-A002,2026-08-20,09:12:00,17:15:00,Remote
EMP-A001,2026-08-19,08:50:00,16:58:00,Office
EMP-9999,2026-08-20,09:00:00,17:00:00,Office`;

    setFileName('biometric_monthly_august.csv');
    const parsed = biometricImportService.parseCSV(demoCsv);
    setCsvHeaders(parsed.headers);
    setCsvRows(parsed.rows);

    const autoMapping = biometricImportService.suggestMapping(parsed.headers);
    setMapping(autoMapping);
    setStep(2);
  };

  // Run validation
  const handleRunValidation = async () => {
    setValidating(true);
    const result = await biometricImportService.validateImportRows(csvRows, mapping, orgId);
    setPreviewResult(result);
    setValidating(false);
    setStep(3);
  };

  // Execute import
  const handleConfirmImport = async () => {
    if (!previewResult) return;
    setImporting(true);
    await biometricImportService.confirmImport(previewResult, fileName, orgId);
    setImporting(false);
    setStep(4);
    loadBatches();
  };

  const resetWizard = () => {
    setStep(1);
    setFileName('');
    setCsvHeaders([]);
    setCsvRows([]);
    setPreviewResult(null);
  };

  return (
    <AttendanceLayout>
      <div className="space-y-6">
        {/* Wizard Progress Header */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              {[
                { s: 1, label: '1. Select File' },
                { s: 2, label: '2. Map Columns' },
                { s: 3, label: '3. Preview & Validation' },
                { s: 4, label: '4. Complete' },
              ].map((item) => (
                <div
                  key={item.s}
                  className={`flex items-center gap-2 text-xs font-bold ${
                    step === item.s
                      ? 'text-indigo-600'
                      : step > item.s
                      ? 'text-emerald-600'
                      : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      step === item.s
                        ? 'bg-indigo-600 text-white'
                        : step > item.s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step > item.s ? <Check size={12} /> : item.s}
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── STEP 1: FILE UPLOAD ────────────────────────────────────────── */}
        {step === 1 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm">Upload Biometric Attendance File</CardTitle>
              <CardDescription className="text-xs">
                Upload a CSV or XLSX file exported from your organization's biometric access control device or hardware.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">Select a CSV or XLSX file to parse</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Supports any column layout. You will map headers in the next step.
                </p>

                <div className="mt-4 flex items-center justify-center gap-3">
                  <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm">
                    <UploadCloud size={16} className="mr-2" /> Browse File
                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <Button variant="outline" size="sm" onClick={loadDemoFile}>
                    Load Demo Biometric File
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2: COLUMN MAPPING ───────────────────────────────────────── */}
        {step === 2 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm">Map File Columns ({fileName})</CardTitle>
              <CardDescription className="text-xs">
                Select which header from your uploaded file corresponds to each attendance attribute.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Number *</label>
                  <select
                    value={mapping.employee_number}
                    onChange={(e) => setMapping({ ...mapping, employee_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Attendance Date *</label>
                  <select
                    value={mapping.attendance_date}
                    onChange={(e) => setMapping({ ...mapping, attendance_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clock In Time</label>
                  <select
                    value={mapping.clock_in}
                    onChange={(e) => setMapping({ ...mapping, clock_in: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clock Out Time</label>
                  <select
                    value={mapping.clock_out}
                    onChange={(e) => setMapping({ ...mapping, clock_out: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
                  >
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={resetWizard}>
                  Cancel / Re-upload
                </Button>
                <Button size="sm" onClick={handleRunValidation} disabled={validating} className="bg-indigo-600 text-white">
                  {validating ? 'Validating...' : 'Validate & Preview'} <ArrowRight size={14} className="ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: PREVIEW & VALIDATION ─────────────────────────────────── */}
        {step === 3 && previewResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <Card className="border-slate-200"><CardContent className="p-3"><div className="text-[10px] uppercase font-bold text-slate-400">Total Rows</div><div className="text-xl font-bold text-slate-800">{previewResult.totalRows}</div></CardContent></Card>
              <Card className="border-slate-200"><CardContent className="p-3"><div className="text-[10px] uppercase font-bold text-emerald-600">Valid Rows</div><div className="text-xl font-bold text-emerald-600">{previewResult.validRows}</div></CardContent></Card>
              <Card className="border-slate-200"><CardContent className="p-3"><div className="text-[10px] uppercase font-bold text-rose-600">Errors</div><div className="text-xl font-bold text-rose-600">{previewResult.errorRows}</div></CardContent></Card>
              <Card className="border-slate-200"><CardContent className="p-3"><div className="text-[10px] uppercase font-bold text-amber-600">Duplicates</div><div className="text-xl font-bold text-amber-600">{previewResult.duplicateRows}</div></CardContent></Card>
            </div>

            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600">Validation Breakdown</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-2.5 px-4 w-16">Row #</th>
                      <th className="py-2.5 px-4">Emp #</th>
                      <th className="py-2.5 px-4">Employee Name</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Punches</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Validation Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.rows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? 'bg-emerald-50/20' : 'bg-rose-50/20'}>
                        <td className="py-2 px-4 font-mono font-semibold">{r.rowNumber}</td>
                        <td className="py-2 px-4 font-mono">{r.employeeNumber}</td>
                        <td className="py-2 px-4 font-medium">{r.staffName || 'Unknown'}</td>
                        <td className="py-2 px-4 font-mono">{r.date}</td>
                        <td className="py-2 px-4 font-mono">{r.clockIn || '—'} / {r.clockOut || '—'}</td>
                        <td className="py-2 px-4 text-center">
                          {r.isValid ? (
                            <Badge variant="success" className="text-[9px]">Valid</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] bg-rose-100 text-rose-700">Invalid</Badge>
                          )}
                        </td>
                        <td className="py-2 px-4 text-rose-600 text-[11px]">
                          {r.errors.join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                Back to Mapping
              </Button>
              <Button size="sm" onClick={handleConfirmImport} disabled={importing || previewResult.validRows === 0} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {importing ? 'Importing Records...' : `Confirm & Import ${previewResult.validRows} Valid Records`}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: COMPLETED ────────────────────────────────────────────── */}
        {step === 4 && (
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Biometric Import Executed</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Valid records have been inserted into the organization's attendance repository and logged in audit trails.
                </p>
              </div>
              <Button size="sm" onClick={resetWizard} className="bg-indigo-600 text-white">
                Import Another File
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Previous Import Batches History Table */}
        <Card className="border-slate-200 overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <History size={14} /> Import Batch History
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Date Uploaded</th>
                  <th className="py-2.5 px-4">File Name</th>
                  <th className="py-2.5 px-4">Uploaded By</th>
                  <th className="py-2.5 px-4 text-center">Total Rows</th>
                  <th className="py-2.5 px-4 text-center">Imported</th>
                  <th className="py-2.5 px-4 text-center">Errors</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">No previous import batches recorded.</td></tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono">{new Date(b.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{b.file_name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{b.uploaded_by}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{b.total_rows}</td>
                      <td className="py-2.5 px-4 text-center font-mono text-emerald-600 font-bold">{b.successful_rows}</td>
                      <td className="py-2.5 px-4 text-center font-mono text-rose-600 font-bold">{b.failed_rows}</td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge variant={b.status === 'completed' ? 'success' : 'secondary'} className="text-[9px] capitalize">
                          {b.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AttendanceLayout>
  );
};
