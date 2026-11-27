import { api } from '@/lib/api';
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
