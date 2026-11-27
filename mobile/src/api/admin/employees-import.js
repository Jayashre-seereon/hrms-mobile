// Bulk employee import — mobile port of the web app's
// src/features/employees/bulk-import/{bulkImport.js, importTemplate.js} and src/api/employeeBulkApi.js.
// The file is read on the phone (SheetJS, same as the web), ordered so managers come first, then sent to
// POST /employees/bulk in chunks of 250. The company comes from the login (X-Company-Id for a Super Admin).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { api } from '@/lib/api';

export const BULK_CHUNK_SIZE = 250;

/* ------------------------------------------------------------------ API (src/api/employeeBulkApi.js) */

export const employeeBulkApi = {
  /** `{ batch_id, dry_run, on_duplicate, send_credentials, rows }` -> `{ total, created, skipped, failed, results, ... }` */
  importRows: (body) => api.post('/employees/bulk', body, { timeout: 120000 }).then((res) => res.data),

  /** `{ batch_id }` -> `{ queued, already_queued, already_sent, no_personal_email, email_configured }` */
  sendCredentials: (batchId) =>
    api.post('/employees/bulk/send-credentials', { batch_id: batchId }, { timeout: 60000 }).then((res) => res.data),
};

/* ------------------------------------------------------------------ reading the file (bulkImport.js) */

/** Columns the server understands, in the order of the downloadable template. */
export const IMPORT_COLUMNS = [
  'employee_code', 'first_name', 'last_name', 'department', 'designation', 'branch_name', 'shift',
  'attendance_pattern', 'grade', 'wage_type', 'ctc', 'daily_rate', 'personal_email', 'phone', 'date_of_birth',
  'gender', 'marital_status', 'blood_group', 'nationality', 'religion', 'father_spouse_name', 'place_of_birth',
  'identification_mark', 'employment_type', 'work_mode',
  'date_of_joining', 'probation_months', 'notice_period_days', 'skill_category', 'pf_applicable',
  'esi_applicable', 'pf_member_id', 'pt_state', 'uan_number', 'esic_number', 'aadhaar_number', 'pan_number',
  'nominee_name', 'pension_scheme', 'family_details', 'service_book_number',
  'bank_account_holder_name', 'bank_name', 'bank_account_number', 'ifsc_code', 'emergency_contact_name',
  'emergency_contact_phone', 'current_address', 'permanent_address', 'qualification', 'institution',
  'year_of_passing', 'education_score', 'manager_employee_code', 'hr_partner_employee_code',
];
const KNOWN = new Set([...IMPORT_COLUMNS, 'status']);
const REQUIRED_COLUMNS = ['employee_code', 'first_name', 'department'];

/** Header spellings from older templates that map onto a server column. */
const ALIASES = { shift_name: 'shift', department_name: 'department', designation_name: 'designation' };
/** Columns the server never takes from a row (company comes from the login, work email is generated). */
const NOT_SENT = new Set([
  'organization_name', 'company_name', 'company_id', 'organization_id', 'branch_id', 'work_email', 'password',
]);
const DIGIT_COLUMNS = new Set([
  'aadhaar_number', 'bank_account_number', 'uan_number', 'esic_number', 'phone', 'emergency_contact_phone',
]);
const DATE_COLUMNS = new Set(['date_of_birth', 'date_of_joining']);
/** Free-text ids that Excel may store as a number (service book 100006): always sent as text. */
const TEXT_COLUMNS = new Set(['service_book_number']);

export const normalizeHeader = (h) =>
  String(h ?? '')
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/** Excel can write a long digit cell in scientific notation; recover it only when it is an exact integer. */
export function normalizeDigits(value) {
  const input = String(value ?? '')
    .trim()
    .replace(/^'/, '')
    .replace(/\s+/g, '');
  if (/^\d+$/.test(input)) return input;
  const match = input.match(/^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return input;
  const [, whole, fraction = '', exponentText] = match;
  if (fraction && /[1-9]/.test(fraction) && !exponentText) return input;
  const digits = `${whole}${fraction}`;
  const point = whole.length + Number(exponentText || 0);
  if (point <= 0 || (point < digits.length && /[1-9]/.test(digits.slice(point)))) return input;
  return point >= digits.length ? `${digits}${'0'.repeat(point - digits.length)}` : digits.slice(0, point);
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Excel date cells arrive as Date objects a few seconds before local midnight, so cutting the ISO string would
 * give the previous day. Half a day is added first, then the local parts are read.
 */
function dateToIso(date) {
  const d = new Date(date.getTime() + 12 * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeDateText(text) {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const local = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return local ? `${local[3]}-${pad(local[2])}-${pad(local[1])}` : t;
}

const YES = new Set(['yes', 'y', 'true', '1']);
const NO = new Set(['no', 'n', 'false', '0']);

function normalizeValue(column, value) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return dateToIso(value);
  let v = typeof value === 'string' ? value.trim() : value;
  if (v === '') return undefined;
  if (DATE_COLUMNS.has(column) && typeof v === 'string') return normalizeDateText(v);
  if (DIGIT_COLUMNS.has(column)) return normalizeDigits(v);
  if (column === 'pf_applicable' || column === 'esi_applicable') {
    const word = String(v).trim().toLowerCase();
    return YES.has(word) ? true : NO.has(word) ? false : v;
  }
  if (column === 'wage_type') {
    const word = String(v).trim().toLowerCase();
    return word === 'monthly' ? 'Monthly' : word === 'daily' ? 'Daily' : v;
  }
  if (column === 'pan_number' || column === 'ifsc_code' || column === 'pension_scheme')
    return String(v).trim().toUpperCase();
  if (TEXT_COLUMNS.has(column)) return String(v).trim();
  if (column === 'employee_code' || column === 'manager_employee_code' || column === 'hr_partner_employee_code')
    return String(v).trim();
  return v;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** `asset` is an expo-document-picker asset: `{ uri, name, mimeType, size }`. */
async function readSheetRows(asset) {
  const ext = String(asset.name ?? '').split('.').pop()?.toLowerCase();
  const file = new File(asset.uri);
  if (ext === 'csv') return parseCsv(await file.text());
  if (ext !== 'xlsx') throw new Error('Choose a CSV or Excel .xlsx file.');
  const workbook = XLSX.read(await file.base64(), { type: 'base64', cellDates: true });
  // The data sheet is "Employees" when there is one, otherwise the first sheet.
  const name = workbook.SheetNames.find((n) => n.toLowerCase() === 'employees') ?? workbook.SheetNames[0];
  if (!name) throw new Error('The Excel workbook has no worksheets.');
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
}

/**
 * Reads a file into rows ready for POST /employees/bulk.
 * Returns `{ headers, records, ignoredColumns, notSentColumns }`; each record is
 * `{ fileRow, raw, data, clientErrors }` where `data` is the object sent to the server.
 */
export async function parseImportFile(asset) {
  // Keep each row's number in the sheet, so a report can say "row 57" even when blank rows were skipped.
  const all = (await readSheetRows(asset))
    .map((values, i) => ({ values, sheetRow: i + 1 }))
    .filter((r) => r.values.some((v) => String(v ?? '').trim() !== ''));
  if (all.length < 2) throw new Error('The file needs a header row and at least one employee.');
  const rawHeaders = all[0].values;
  const columns = rawHeaders.map((h) => {
    const n = normalizeHeader(h);
    return ALIASES[n] ?? n;
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) throw new Error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);

  const ignoredColumns = [
    ...new Set(columns.filter((c) => c && !KNOWN.has(c) && !NOT_SENT.has(c) && c !== 'bank_account_number_confirm')),
  ];
  const notSentColumns = [...new Set(columns.filter((c) => NOT_SENT.has(c)))];

  const records = all.slice(1).map(({ values, sheetRow }) => {
    const data = {};
    columns.forEach((column, idx) => {
      if (!column || NOT_SENT.has(column) || column === 'bank_account_number_confirm') return;
      const v = normalizeValue(column, values[idx]);
      if (v !== undefined) data[column] = v;
    });
    const clientErrors = [];
    const confirmIdx = columns.indexOf('bank_account_number_confirm');
    if (confirmIdx >= 0) {
      const confirm = normalizeValue('bank_account_number', values[confirmIdx]);
      if (
        confirm !== undefined &&
        data.bank_account_number !== undefined &&
        String(confirm) !== String(data.bank_account_number)
      )
        clientErrors.push({ field: 'bank_account_number_confirm', msg: 'The re-entered account number does not match.' });
    }
    return { fileRow: sheetRow, raw: values, data, clientErrors };
  });

  // The same employee_code twice in one file: the first row goes through, the repeats are reported.
  const firstRow = new Map();
  for (const r of records) {
    const code = r.data.employee_code;
    if (code === undefined) continue;
    const key = String(code).toLowerCase();
    if (firstRow.has(key))
      r.clientErrors.push({
        field: 'employee_code',
        msg: `employee_code repeated in the file (first on row ${firstRow.get(key)}).`,
      });
    else firstRow.set(key, r.fileRow);
  }
  return { headers: rawHeaders, records, ignoredColumns, notSentColumns };
}

/**
 * Managers (and HR partners) must be created before the people who report to them. Rows get a depth:
 * 0 when they name nobody in this file, otherwise one more than the deepest person they name. A circle of
 * names cannot be ordered, so those rows are left at depth 0 and the server reports the unknown code.
 */
export function orderForManagers(records) {
  const byCode = new Map(records.map((r) => [String(r.data.employee_code ?? '').toLowerCase(), r]));
  const depth = new Map();
  const visiting = new Set();
  const depthOf = (r) => {
    if (depth.has(r)) return depth.get(r);
    if (visiting.has(r)) return 0;
    visiting.add(r);
    let d = 0;
    for (const key of ['manager_employee_code', 'hr_partner_employee_code']) {
      const code = r.data[key];
      const boss = code !== undefined ? byCode.get(String(code).toLowerCase()) : undefined;
      if (boss && boss !== r) d = Math.max(d, depthOf(boss) + 1);
    }
    visiting.delete(r);
    depth.set(r, d);
    return d;
  };
  return records
    .map((r, i) => ({ r, i, d: depthOf(r) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.r);
}

export const chunkRecords = (records, size = BULK_CHUNK_SIZE) => {
  const out = [];
  for (let i = 0; i < records.length; i += size) out.push(records.slice(i, i + size));
  return out;
};

/** "field: message" text from a server error body (a string, or FastAPI's list). */
export function apiErrorText(error, fallback = 'The import call failed.') {
  const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? JSON.stringify(d)).join('; ');
  if (error && !error.response && error.isAxiosError) return 'Cannot reach the server. Check your connection and try again.';
  return error?.userMessage || error?.message || fallback;
}

/** True when sending the same chunk again is the right answer (network drop, timeout, gateway error). */
export function isRetryable(error) {
  const status = error?.response?.status;
  return !status || status === 502 || status === 503 || status === 504 || error?.code === 'ECONNABORTED';
}

/* ------------------------------------------------------------------ saving files on the phone */

/** Writes a file to the cache and opens the share sheet (Save to Files / Drive / WhatsApp …). */
async function shareFile(filename, content, { base64 = false, mimeType, uti } = {}) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(content, base64 ? { encoding: 'base64' } : undefined);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: filename });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function shareWorkbook(wb, filename) {
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await shareFile(filename, b64, { base64: true, mimeType: XLSX_MIME, uti: 'org.openxmlformats.spreadsheetml.sheet' });
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV of every problem: file row, employee_code, field, message. */
export async function downloadErrorReport(failed, filename = 'employee-import-errors.csv') {
  const lines = ['file_row,employee_code,field,message'];
  for (const f of failed) {
    const errors = f.errors.length ? f.errors : [{ field: '', msg: 'Not imported' }];
    for (const e of errors)
      lines.push([f.fileRow, f.employee_code ?? '', e.field ?? '', e.msg ?? ''].map(csvCell).join(','));
  }
  await shareFile(filename, `﻿${lines.join('\n')}\n`, { mimeType: 'text/csv', uti: 'public.comma-separated-values-text' });
}

/** The failed rows as an Excel file in the original layout, ready to fix and upload again. */
export async function downloadFailedRows(headers, failedRecords, filename = 'employee-import-failed-rows.xlsx') {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...failedRecords.map((r) => r.raw)], { cellDates: true });
  sheet['!cols'] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 16) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Employees');
  await shareWorkbook(wb, filename);
}

/* ------------------------------------------------------------------ template (importTemplate.js) */

const listOf = (res) => {
  const d = res?.data?.data ?? res?.data ?? res ?? [];
  if (Array.isArray(d)) return d;
  for (const k of ['items', 'results', 'departments', 'designations', 'branches', 'shifts', 'patterns', 'pay_grades', 'data'])
    if (Array.isArray(d?.[k])) return d[k];
  return [];
};
const first = (o, ...keys) => {
  for (const k of keys) if (o?.[k]) return String(o[k]);
  return '';
};

const SAMPLE = {
  employee_code: 'EMP-0001', first_name: 'Asha', last_name: 'Patel', wage_type: 'Monthly', ctc: 600000,
  personal_email: 'asha.patel@example.com', phone: '9876543210', date_of_birth: '1995-04-12', gender: 'Female',
  employment_type: 'Full-time', work_mode: 'office', date_of_joining: '2026-12-01', pf_applicable: 'Yes',
  esi_applicable: 'No', aadhaar_number: '123412341234', pan_number: 'ABCDE1234F',
  father_spouse_name: 'Ramesh Patel', place_of_birth: 'Ahmedabad', identification_mark: 'Mole on left cheek',
  nominee_name: 'Meena Patel', pension_scheme: 'EPS', family_details: 'Meena Patel; Karan Patel', service_book_number: '100006',
  bank_account_holder_name: 'Asha Patel', bank_name: 'HDFC Bank', bank_account_number: '50100123456789',
  ifsc_code: 'HDFC0001234',
};

const FIXED_VALUES = {
  wage_type: ['Monthly', 'Daily'],
  gender: ['Male', 'Female', 'Other', 'Prefer not to say'],
  employment_type: ['Full-time', 'Part-time', 'Contract', 'Intern'],
  work_mode: ['office', 'remote', 'hybrid'],
  skill_category: ['Unskilled', 'Semi-skilled', 'Skilled', 'Highly skilled'],
  pf_applicable: ['Yes', 'No'],
  esi_applicable: ['Yes', 'No'],
  pension_scheme: ['EPS', 'NPS'],
};

/**
 * Builds the Excel template (header + sample row, a "Valid values" sheet filled from the company's own master
 * lists, and "How to fill") and opens the share sheet. Returns the master lists that could not be loaded.
 */
export async function downloadImportTemplate() {
  // Same calls as the web: departmentApi, designationApi, Branch_api, shift, attendance_pattern, payGradeApi.
  const [departments, designations, branches, shifts, patterns, grades] = await Promise.allSettled([
    api.get('/departments'),
    api.get('/super-admin/designations'),
    api.get('/super-admin/branches'),
    api.get('/attendance/shifts', { params: { page: 1, page_size: 100 } }),
    api.get('/attendance/patterns'),
    api.get('/pay-grades', { params: { status: 'Active', page_size: 100 } }),
  ]);
  const rows = (r) => (r.status === 'fulfilled' ? listOf(r.value) : []);
  const failed = [
    ['departments', departments], ['designations', designations], ['branches', branches],
    ['shifts', shifts], ['attendance patterns', patterns], ['pay grades', grades],
  ]
    .filter(([, r]) => r.status === 'rejected')
    .map(([name]) => name);

  const deptName = new Map(rows(departments).map((d) => [String(d.id), first(d, 'department_name', 'name')]));
  const lists = {
    department: rows(departments).map((d) => first(d, 'department_name', 'name')),
    designation: rows(designations).map((d) => first(d, 'designation_name', 'name')),
    designation_department: rows(designations).map((d) => deptName.get(String(d.department_id)) ?? ''),
    branch_name: rows(branches).map((b) => first(b, 'branch_name', 'name')),
    shift: rows(shifts).map((s) => first(s, 'shift_name', 'name')),
    attendance_pattern: rows(patterns).map((p) => first(p, 'pattern_name', 'name', 'attendance_pattern_name')),
    grade: rows(grades)
      .filter((g) => g.grade_code)
      .map((g) => String(g.grade_code)),
    ...FIXED_VALUES,
  };
  const columns = Object.keys(lists);
  const depth = Math.max(...columns.map((c) => lists[c].length), 1);
  const valid = [columns, ...Array.from({ length: depth }, (_, i) => columns.map((c) => lists[c][i] ?? ''))];

  const main = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS, IMPORT_COLUMNS.map((c) => SAMPLE[c] ?? '')]);
  main['!cols'] = IMPORT_COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 18) }));
  const validSheet = XLSX.utils.aoa_to_sheet(valid);
  validSheet['!cols'] = columns.map((c) => ({ wch: Math.max(c.length + 2, 20) }));
  const notes = XLSX.utils.aoa_to_sheet([
    ['How to fill'],
    ['Row 1 is the header: do not rename or reorder it. Row 2 is a sample: replace it with your first employee.'],
    ['Required on every row: employee_code, first_name, department, and the pay for the wage type (Monthly needs ctc, Daily needs daily_rate).'],
    ["department, designation, branch_name, shift, attendance_pattern and grade must match a name on the 'Valid values' sheet."],
    ['A designation must belong to the department on the same row.'],
    ['Dates are yyyy-mm-dd. Format phone, Aadhaar, account numbers, UAN and ESIC columns as Text so Excel keeps every digit.'],
    ['esic_number is the 10-digit ESIC insurance number. pension_scheme is EPS or NPS. service_book_number is optional.'],
    ['father_spouse_name, place_of_birth, identification_mark, nominee_name and family_details are optional free text (family_details: names separated by ;).'],
    ['manager_employee_code and hr_partner_employee_code are employee codes of people in this file or already in the system.'],
  ]);
  notes['!cols'] = [{ wch: 130 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, main, 'Employees');
  XLSX.utils.book_append_sheet(wb, validSheet, 'Valid values');
  XLSX.utils.book_append_sheet(wb, notes, 'How to fill');
  await shareWorkbook(wb, 'employee-import-template.xlsx');
  return failed;
}

/* ------------------------------------------------------------------ previous imports (for Send credentials) */
// The web keeps these in localStorage; the phone keeps them in a small JSON file (SecureStore has a size limit).

const batchFile = () => new File(Paths.document, 'employee-import-batches.v1.json');

export async function loadBatches() {
  try {
    const f = batchFile();
    if (!f.exists) return [];
    const list = JSON.parse(await f.text());
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeBatches(list) {
  try {
    const f = batchFile();
    if (!f.exists) f.create();
    await f.write(JSON.stringify(list));
  } catch {
    // not critical: the list is only a convenience for "Send credentials"
  }
  return list;
}

export async function saveBatch(batch) {
  const list = [batch, ...(await loadBatches()).filter((b) => b.batch_id !== batch.batch_id)].slice(0, 15);
  return writeBatches(list);
}

export async function updateBatch(batchId, patch) {
  const list = (await loadBatches()).map((b) => (b.batch_id === batchId ? { ...b, ...patch } : b));
  return writeBatches(list);
}

export const newBatchId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/**
 * Who may bulk-upload — same rule as the web Employees screen:
 * (role holds "employee.manage" in the web role matrix, or canCreateEmployee(role)) && not EMPLOYEE && can("employee.edit").
 * Roles with employee.manage on the web: SuperAdmin, Admin, CEO ("*"), BranchAdmin, COO, CTO, CHRO, HR, HOD.
 */
const MANAGE_PEOPLE_ROLES = new Set([
  'SUPER_ADMIN', 'SUPERADMIN', 'COMPANY_ADMIN', 'ADMIN', 'BRANCH_ADMIN', 'BRANCHADMIN',
  'CEO', 'COO', 'CTO', 'CHRO', 'HR', 'HOD',
]);
export function canBulkImportEmployees(role, can) {
  const r = String(role ?? '').toUpperCase();
  return MANAGE_PEOPLE_ROLES.has(r) && r !== 'EMPLOYEE' && can('employee.edit');
}
