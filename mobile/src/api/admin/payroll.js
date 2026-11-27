import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { api } from '@/lib/api';
import { clean, rowsOf } from './common';
/**
 * Payroll runs — same endpoints and bodies as the web payrollRunApi (src/api/payrollRunApi.js).
 * Every run action answers with the refreshed run.
 */
const run = (id) => `/payroll/runs/${encodeURIComponent(id)}`;
const data = (res) => res.data;

/** Run statuses in which the run can still be changed (checks, adjustments). Same list as web/backend EDITABLE. */
export const EDITABLE = ['Draft', 'Checks Failed', 'Checks Passed'];
export const RUN_STATUSES = [
  'Draft',
  'Checks Failed',
  'Checks Passed',
  'Pending Approval',
  'Approved',
  'Processed',
  'Paid',
  'Rejected',
];

/* ------------------------------------------------------------------ runs */

export async function listPayrollRuns(params = {}) {
  const { data: body } = await api.get('/payroll/runs', { params: clean({ page: 1, limit: 50, ...params }) });
  return rowsOf(body).sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1));
}
/** GET /payroll/runs/{id}?q=&state= — `q` / `state` (error | warning | ok) only narrow `lines`. */
export const getPayrollRun = async (id, params = {}) => (await api.get(run(id), { params: clean(params) })).data;
/** POST /payroll/runs { period: "YYYY-MM", pay_date: "YYYY-MM-DD" } — needs payroll.run. */
export const createPayrollRun = (body) => api.post('/payroll/runs', clean(body)).then(data);
/** GET /payroll/runs/{id}/lines/{employeeId} — one employee's payslip working. */
export const getPayrollLine = (id, employeeId) =>
  api.get(`${run(id)}/lines/${encodeURIComponent(employeeId)}`).then(data);
/** GET /payroll/runs/{id}/payment-records?month=YYYY-MM&status=paid|unpaid → { items, paid_count, unpaid_count }. */
export const getPaymentRecords = (id, month, status) =>
  api.get(`${run(id)}/payment-records`, { params: clean({ month, status }) }).then(data);

/** POST /payroll/runs/{id}/checks — (re)calculates and validates the run. */
export const runPayrollChecks = (id) => api.post(`${run(id)}/checks`).then(data);
/** POST .../checks/{checkId}/resolve { action: "fix" | "override", note } (override needs a note). */
export const resolvePayrollCheck = (id, checkId, body) =>
  api.post(`${run(id)}/checks/${encodeURIComponent(checkId)}/resolve`, body).then(data);
/** POST .../checks/{checkId}/escalate { note? } */
export const escalatePayrollCheck = (id, checkId, body = {}) =>
  api.post(`${run(id)}/checks/${encodeURIComponent(checkId)}/escalate`, body).then(data);
export const acknowledgePayrollWarnings = (id) => api.post(`${run(id)}/warnings/acknowledge`).then(data);
export const submitPayrollRun = (id) => api.post(`${run(id)}/submit`).then(data);
/** POST /payroll/runs/{id}/approvals { decision: "approve" | "reject", remarks } — needs payroll.approve. */
export const decidePayrollRun = async (id, decision, remarks = '') =>
  (await api.post(`${run(id)}/approvals`, { decision, remarks })).data;
/** POST .../send-back { remark } — Pending Approval → Draft. */
export const sendBackPayrollRun = (id, remark) => api.post(`${run(id)}/send-back`, { remark }).then(data);
/** POST .../process — Approved → Processed (payslips created). Needs payroll.process. */
export const processPayrollRun = (id) => api.post(`${run(id)}/process`).then(data);
/** POST .../payment { reference } — Processed → Paid. Needs payroll.process. */
export const payPayrollRun = (id, reference) => api.post(`${run(id)}/payment`, { reference }).then(data);
/** POST .../reopen — Rejected / Checks Failed / Checks Passed → Draft. */
export const reopenPayrollRun = (id) => api.post(`${run(id)}/reopen`).then(data);

/**
 * POST .../payment-upload (multipart: month, file) — bank payment advice (.xlsx / .xls / .csv).
 * `asset` is an expo-document-picker asset. Answers `{ success, errors?, paid_employees, transaction_count, ... }`.
 */
export function uploadPaymentAdvice(id, month, asset) {
  const form = new FormData();
  form.append('month', month);
  form.append('file', {
    uri: asset.uri,
    name: asset.name || 'payment-advice.xlsx',
    type: asset.mimeType || 'application/octet-stream',
  });
  return api
    .post(`${run(id)}/payment-upload`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
    .then(data);
}

/** Saves PDF bytes from the API into the cache and opens the share sheet (same flow as src/api/payslips.js). */
async function sharePdf(bytes, filename, title) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(bytes));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
  }
  return file.uri;
}
const safe = (s) => String(s ?? '').replace(/[^\w.-]+/g, '_');

/** GET .../payslips/pdf?employee_id= — one employee's salary slip (run Approved / Processed / Paid). */
export async function shareEmployeePayslipPdf(runId, employeeId, { period, code } = {}) {
  const res = await api.get(`${run(runId)}/payslips/pdf`, {
    params: { employee_id: employeeId },
    responseType: 'arraybuffer',
    headers: { Accept: 'application/pdf' },
    timeout: 120000,
  });
  return sharePdf(res.data, `payslip-${safe(code || employeeId)}-${safe(period)}.pdf`, `Payslip ${period ?? ''}`);
}
/** POST .../payslips/publish — "Generate salary slips": every slip of the run as one PDF. */
export async function publishPayslips(runId, period) {
  const res = await api.post(`${run(runId)}/payslips/publish`, undefined, {
    responseType: 'arraybuffer',
    headers: { Accept: 'application/pdf' },
    timeout: 180000,
  });
  return sharePdf(res.data, `salary-slips-${safe(period)}.pdf`, `Salary slips ${period ?? ''}`);
}

/** Same CSV the web "Payroll <Month> <Year> CSV" button builds from the run's lines, shared as a file. */
export async function shareRegisterCsv(runData) {
  const [year, month] = String(runData?.period ?? '').split('-');
  const monthName = month
    ? new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    : 'Unknown-Month';
  const full = await getPayrollRun(runData.id);
  const lines = full?.lines ?? [];
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Employee Code', 'Employee Name', 'Net', 'Bank Account', 'IFSC'],
    ...lines.map((l) => [
      l.employee_code,
      l.employee_name,
      l.net,
      l.bank?.account_no ?? l.bank?.account_number ?? l.bank?.accountNo,
      l.bank?.ifsc ?? l.bank?.ifsc_code ?? l.bank?.ifscCode,
    ]),
  ];
  const csv = `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;
  const file = new File(Paths.cache, `Payroll-${monthName}-${year || 'unknown'}.csv`);
  if (file.exists) file.delete();
  file.create();
  await file.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  }
  return file.uri;
}

/* ------------------------------------------------------------------ adjustments */

/** GET /payroll/adjustments?period=&employee_id= → array of { id, employee_id, period, label, kind, amount }. */
export const listAdjustments = async (params = {}) =>
  rowsOf((await api.get('/payroll/adjustments', { params: clean(params) })).data);
/** POST /payroll/adjustments { employee_id, period, label, kind: "earning" | "deduction", amount } — payroll.run. */
export const addAdjustment = (body) => api.post('/payroll/adjustments', clean(body)).then(data);
export const removeAdjustment = (id) => api.delete(`/payroll/adjustments/${encodeURIComponent(id)}`).then(data);

/* ------------------------------------------------------------------ policy */

export const getPayrollPolicy = () => api.get('/payroll/policy').then(data);
/** PUT /payroll/policy — merges; send only the section being changed. Only an admin may save. */
export const updatePayrollPolicy = (body) => api.put('/payroll/policy', body).then(data);

/* ------------------------------------------------------------------ salary */

/**
 * POST /payroll/salary-preview { wage_type, ctc | daily_rate, component_overrides?, pf_applicable, esi_applicable,
 * pt_state? } → { paid_days, gross, net, employer_cost, earnings, deductions }. Needs payroll.view.
 */
export const salaryPreview = (body) => api.post('/payroll/salary-preview', body).then(data);
/** GET → { employee_id, components: [{ label, monthly_amount, is_basic }] } */
export const getSalaryComponents = (employeeId) =>
  api.get(`/payroll/employees/${encodeURIComponent(employeeId)}/salary-components`).then(data);
/** PUT with the full list [{ label, monthly_amount, is_basic }] (exactly one basic, unique labels). payroll.run. */
export const saveSalaryComponents = (employeeId, components) =>
  api.put(`/payroll/employees/${encodeURIComponent(employeeId)}/salary-components`, components).then(data);
