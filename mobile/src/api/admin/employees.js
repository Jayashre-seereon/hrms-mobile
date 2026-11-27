import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { clean, num, rowsOf } from './common';
/** GET /employees — paginated, `search` / `status` filters (limit max 100). */
export async function getEmployees({ page = 1, limit = 20, search = '', status = '' } = {}) {
  const { data } = await api.get('/employees', {
    params: clean({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      search: search.trim(),
      status,
    }),
  });
  const items = rowsOf(data);
  return { items, total: Array.isArray(data) ? items.length : num(data?.total ?? data?.count), page, limit };
}
/** GET /employees/{id} — `id` is the employee profile id (not user_id). */
export async function getEmployeeById(id) {
  const { data } = await api.get(`/employees/${encodeURIComponent(id)}`);
  return data?.data && !Array.isArray(data.data) ? data.data : data;
}
/** GET /employees/{id}/documents */
export async function getEmployeeDocuments(id) {
  const { data } = await api.get(`/employees/${encodeURIComponent(id)}/documents`);
  return rowsOf(data, 'documents');
}

// ---------------------------------------------------------------------------
// Add / Edit employee form (web: src/api/employeeApi.js createEmployee / patchEmployeeForm)
// ---------------------------------------------------------------------------

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** POST /employees/form — create an employee (multipart: text fields + document files). */
export async function createEmployee(formData) {
  const { data } = await api.post('/employees/form', formData, MULTIPART);
  return data?.data && !Array.isArray(data.data) ? data.data : data;
}

/**
 * PATCH /employees/{id}/form — edit fields AND files in one multipart call. Send only what changed;
 * the string "null" clears optional values. work_email and employee_code cannot be edited.
 */
export async function patchEmployeeForm(id, formData) {
  const { data } = await api.patch(`/employees/${encodeURIComponent(id)}/form`, formData, MULTIPART);
  return data?.data && !Array.isArray(data.data) ? data.data : data;
}

/** GET /payroll/pay-components → [{ code, name, calculation_type }] — the codes pc_<CODE> accepts. */
export async function getPayComponents() {
  const { data } = await api.get('/payroll/pay-components');
  return Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
}

/** GET /pay-grades (active) — the only grade codes the server accepts. */
export async function getActivePayGrades() {
  const { data } = await api.get('/pay-grades', { params: { status: 'Active', page_size: 100 } });
  const d = data?.data ?? data ?? [];
  const rows = Array.isArray(d) ? d : (d.items ?? d.pay_grades ?? []);
  return rows.filter((g) => g.grade_code && (g.status ?? 'Active') === 'Active');
}

/** GET /organisation — organisation name (used for the Gmail-style work email). */
export async function getOrganisation() {
  const { data } = await api.get('/organisation');
  return data?.data ?? data;
}

/** GET /super-admin/companies (Super Admin). */
export async function getCompanies() {
  const { data } = await api.get('/super-admin/companies');
  return rowsOf(data, 'companies');
}

/** GET /super-admin/companies/{id} — read for its work_email_prefix. */
export async function getCompany(companyId) {
  const { data } = await api.get(`/super-admin/companies/${companyId}`);
  return data?.data ?? data ?? {};
}

/** GET /super-admin/branches?company_id= */
export async function getBranches(companyId) {
  const { data } = await api.get('/super-admin/branches', { params: companyId ? { company_id: companyId } : {} });
  return rowsOf(data, 'branches');
}

/** Job & Role dropdown sources (web: useEmployeeJobOptions). */
export async function getDepartmentOptions(companyId) {
  const { data } = await api.get('/departments', { params: companyId ? { company_id: companyId } : {} });
  return rowsOf(data, 'departments').map((d) => ({ id: d.id, name: d.department_name ?? d.name ?? '' }));
}

export async function getDesignationOptions(companyId) {
  const { data } = await api.get('/super-admin/designations', { params: companyId ? { company_id: companyId } : {} });
  return rowsOf(data, 'designations').map((d) => ({
    id: d.id,
    name: d.designation_name ?? d.name ?? '',
    departmentId: d.department_id ?? '',
  }));
}

export async function getRoleOptions(companyId) {
  const { data } = await api.get('/roles', { params: companyId ? { company_id: companyId } : {} });
  const body = data?.data ?? data;
  return (Array.isArray(body) ? body : rowsOf(body, 'roles'))
    .map((r) => ({ id: r.id, name: r.role_name ?? r.name ?? '', status: r.status }))
    .filter((r) => r.name && (!r.status || String(r.status).toLowerCase() === 'active'));
}

export async function getShiftOptions(orgId) {
  const { data } = await api.get('/attendance/shifts', {
    params: { ...(orgId ? { organization_id: orgId } : {}), page: 1, page_size: 100 },
  });
  return rowsOf(data).map((x) => ({
    id: x.id,
    name: x.shift_name ?? x.name ?? '',
    start: String(x.start_time ?? '').slice(0, 5),
    end: String(x.end_time ?? '').slice(0, 5),
  }));
}

/** Managers / HR people (GET /employees?designation_type=manager|hr). */
export async function getStaffOptions(designationType, companyId) {
  const { data } = await api.get('/employees', {
    params: clean({ page: 1, limit: 100, designation_type: designationType, company_id: companyId }),
  });
  return rowsOf(data, 'employees');
}

// ---------------------------------------------------------------------------
// Record updates, documents and Form XIII (web: src/api/employeeApi.js)
// ---------------------------------------------------------------------------

/** PUT /employees/{id} — replace/update employee details (JSON body, sent as given). */
export async function updateEmployee(id, employeeData) {
  if (!id) throw new Error('Employee profile ID is required.');
  const { data } = await api.put(`/employees/${encodeURIComponent(id)}`, employeeData);
  return data;
}

/**
 * PATCH /employees/{id} — partial update (JSON). work_email, password and organization_id are
 * forbidden by the EmployeeUpdate schema and are dropped, like the web.
 */
export async function patchEmployee(id, employeeData) {
  if (!id) throw new Error('Employee profile ID is required.');
  const FORBIDDEN = new Set(['work_email', 'password', 'organization_id']);
  const body = {};
  if (employeeData && typeof employeeData === 'object') {
    Object.entries(employeeData).forEach(([k, v]) => {
      if (!FORBIDDEN.has(k) && v !== undefined) body[k] = v;
    });
  }
  const { data } = await api.patch(`/employees/${encodeURIComponent(id)}`, body);
  return data;
}

/**
 * Document types POST/PATCH /employees/{id}/documents accept (one multipart file field each).
 * passport_photo / e_signature / employer_signature are not accepted here — they go through
 * PATCH /employees/{id}/form (the Edit form).
 */
export const DOCUMENT_UPLOAD_TYPES = [
  ['aadhaar_card', 'Aadhaar Card'],
  ['pan_card', 'PAN Card'],
  ['driving_license', 'Driving License'],
  ['passport', 'Passport'],
  ['resume', 'Resume / CV'],
  ['offer_letter', 'Offer Letter'],
  ['appointment_letter', 'Appointment Letter'],
  ['educational_certificate', 'Educational Certificate'],
  ['address_proof', 'Address Proof'],
  ['passbook', 'Cancelled Cheque / Passbook'],
];

/** `{ aadhaar_card: { uri, name, mimeType } , ... }` → FormData with one file part per document type. */
export function documentsFormData(files = {}) {
  const fd = new FormData();
  Object.entries(files).forEach(([type, f]) => {
    if (f?.uri) fd.append(type, { uri: f.uri, name: f.name || type, type: f.mimeType || 'application/octet-stream' });
  });
  return fd;
}

/** POST /employees/{id}/documents — upload documents (multipart FormData). */
export async function uploadEmployeeDocuments(id, documentData) {
  const { data } = await api.post(`/employees/${encodeURIComponent(id)}/documents`, documentData, MULTIPART);
  return data;
}

/** PATCH /employees/{id}/documents — update / replace documents (multipart FormData). */
export async function patchEmployeeDocuments(id, documentData) {
  const { data } = await api.patch(`/employees/${encodeURIComponent(id)}/documents`, documentData, MULTIPART);
  return data;
}

/** POST /employees/{id}/documents/{document_type} — one file in the `file` field. */
export async function uploadSingleEmployeeDocument(id, documentType, documentData) {
  const { data } = await api.post(
    `/employees/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentType)}`,
    documentData,
    MULTIPART,
  );
  return data;
}

/** PATCH /employees/{id}/documents/{document_type} — re-upload one file in the `file` field. */
export async function patchSingleEmployeeDocument(id, documentType, documentData) {
  const { data } = await api.patch(
    `/employees/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentType)}`,
    documentData,
    MULTIPART,
  );
  return data;
}

/** `view_url` values come back as relative paths ("/api/v1/...") — prefix them with the API origin. */
export function resolveApiUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = (API_URL.match(/^https?:\/\/[^/]+/i) || [''])[0];
  return url.startsWith('/') ? `${origin}${url}` : `${API_URL}/${url}`;
}

function bytesToText(buf) {
  try {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(buf);
  } catch {
    // fall through
  }
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 1) s += String.fromCharCode(u8[i]);
  return s;
}

/**
 * POST /employees/form-xiii?employee_id=…&output=pdf — the filled Form XIII PDF (web: downloadEmployeeFormXiii).
 * The web posts an empty FormData; on Android an empty multipart body cannot be built (OkHttp), and the
 * endpoint reads only query params, so native sends no body. Returns { bytes: ArrayBuffer, filename }.
 */
export async function downloadEmployeeFormXiii(employeeId, fallbackName) {
  if (!employeeId) throw new Error('Employee ID is required to download Form XIII.');
  try {
    const res = await api.post('/employees/form-xiii', Platform.OS === 'web' ? new FormData() : undefined, {
      params: { employee_id: employeeId, output: 'pdf' },
      responseType: 'arraybuffer',
      headers: { Accept: 'application/pdf' },
    });
    const disposition = res.headers?.['content-disposition'] || '';
    const m = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    const filename = decodeURIComponent(m?.[1] || m?.[2] || `Form_XIII_${fallbackName || employeeId}.pdf`);
    return { bytes: res.data, filename };
  } catch (error) {
    // The error body is an ArrayBuffer too — read the backend's `detail` out of it.
    const body = error?.response?.data;
    if (body && typeof body === 'object' && typeof body.byteLength === 'number') {
      try {
        error.response.data = JSON.parse(bytesToText(body));
      } catch {
        error.response.data = {};
      }
    }
    throw error;
  }
}

/** Downloads Form XIII and opens the share sheet (native) or saves the file (web). */
export async function downloadAndShareFormXiii(employeeId, fallbackName) {
  const { bytes, filename } = await downloadEmployeeFormXiii(employeeId, fallbackName);
  const safeName = filename.replace(/[\/:*?"<>|]+/g, '_');
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return safeName;
  }
  const file = new File(Paths.cache, safeName);
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(bytes));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Form XIII' });
  }
  return file.uri;
}
