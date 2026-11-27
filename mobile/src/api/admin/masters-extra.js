import { api } from '@/lib/api';
import { rowsOf, unwrap } from './common';
const clean = (v) => String(v ?? '').trim();
/* ---------- performance indicator category id (web performanceIndicatorAdapter.resolveCategoryId) ---------- */
export async function findPerformanceCategoryId(categoryName) {
  const wanted = clean(categoryName).toLowerCase();
  if (!wanted) return undefined;
  try {
    const { data } = await api.get('/performance-indicators/categories');
    const list = rowsOf(data, 'data', 'categories');
    const match = list.find((item) => {
      if (!item || typeof item !== 'object') return false;
      return clean(item.name ?? item.category_name ?? item.label).toLowerCase() === wanted;
    });
    const id = match ? (match.id ?? match.category_id ?? match.value) : undefined;
    return id != null ? String(id) : undefined;
  } catch {
    return undefined; // the payload is still sent with the category name only
  }
}
/* ---------- holiday calendars (web recruitmentMasterAdapters.createHolidayCalendarApi) ----------
   UI name <-> holiday_title, type "National" <-> "NATIONAL", payType "Paid" <-> leave_category "PAID",
   holidays [{ date, name }] <-> [{ holiday_date, holiday_name }]. Excel upload: POST /upload (multipart "file"). */
const HC = '/attendance/holiday-calendars';
export const HOLIDAY_TYPES = ['National', 'Regional / State', 'Optional / Restricted'];
export const HOLIDAY_PAY_TYPES = ['Paid', 'Unpaid'];
const TYPE_TO_API = {
  National: 'NATIONAL',
  'Regional / State': 'REGIONAL_STATE',
  'Optional / Restricted': 'OPTIONAL_RESTRICTED',
};
const TYPE_FROM_API = Object.fromEntries(Object.entries(TYPE_TO_API).map(([ui, apiValue]) => [apiValue, ui]));
const CAT_TO_API = { Paid: 'PAID', Unpaid: 'UNPAID' };
const CAT_FROM_API = { PAID: 'Paid', UNPAID: 'Unpaid' };
export function calendarFromApi(r) {
  return {
    id: String(r?.id ?? ''),
    name: r?.holiday_title ?? '',
    type: TYPE_FROM_API[String(r?.type ?? '').toUpperCase()] ?? r?.type ?? '',
    year: Number(r?.year ?? new Date().getFullYear()),
    payType: CAT_FROM_API[String(r?.leave_category ?? '').toUpperCase()] ?? 'Paid',
    holidays: (Array.isArray(r?.holidays) ? r.holidays : []).map((h) => ({
      date: h.holiday_date ?? '',
      name: h.holiday_name ?? '',
    })),
    uploadedFile: r?.csv_file_name ?? '',
  };
}
const calendarPayload = (c) => ({
  holiday_title: clean(c.name),
  type: TYPE_TO_API[c.type] ?? c.type,
  year: Number(c.year),
  leave_category: CAT_TO_API[c.payType] ?? 'PAID',
  holidays: (c.holidays ?? []).map((h) => ({ holiday_date: h.date, holiday_name: clean(h.name) })),
});
export const listHolidayCalendars = async () =>
  rowsOf((await api.get(HC, { params: { page: 1, page_size: 100 } })).data, 'data').map(calendarFromApi);
export const getHolidayCalendar = async (id) =>
  calendarFromApi(unwrap((await api.get(`${HC}/${encodeURIComponent(id)}`)).data) ?? {});
export const createHolidayCalendar = async (c) => (await api.post(HC, calendarPayload(c))).data;
export const updateHolidayCalendar = async (id, c) =>
  (await api.put(`${HC}/${encodeURIComponent(id)}`, calendarPayload(c))).data;
export const deleteHolidayCalendar = async (id) => (await api.delete(`${HC}/${encodeURIComponent(id)}`)).data;
/** POST /upload — the backend creates one calendar per Holiday Title + Year from the Excel file. */
export async function uploadHolidayCalendars(file) {
  const fd = new FormData();
  fd.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const { data } = await api.post(`${HC}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return rowsOf(data, 'data').map(calendarFromApi);
}
/** Same checks as the web calendarError (ConfigHubTabs.jsx). */
export function calendarError(c, nameError) {
  const calName = nameError(c.name, 'Calendar name');
  if (calName) return calName;
  if (c.holidays.some((h) => !h.name.trim() || !h.date)) return 'Every holiday needs a date and a name.';
  for (const h of c.holidays) {
    const holName = nameError(h.name, `Holiday name "${h.name.trim()}"`);
    if (holName) return holName;
  }
  if (c.holidays.some((h) => !h.date.startsWith(`${c.year}-`))) return `All dates must fall in ${c.year}.`;
  if (new Set(c.holidays.map((h) => h.date)).size !== c.holidays.length) return 'The same date is listed twice.';
  if (!HOLIDAY_PAY_TYPES.includes(c.payType ?? 'Paid')) return 'Select whether the calendar is Paid or Unpaid.';
  return null;
}
export function branchFromApi(b) {
  return {
    id: String(b.id),
    companyId: String(b.company_id ?? b.companyId ?? ''),
    name: b.name ?? '',
    code: b.code ?? '',
    city: b.city ?? '',
    state: b.state ?? '',
    pincode: b.pincode ?? '',
    address: b.address ?? '',
    isHq: Boolean(b.is_headquarters || b.is_head_office),
    head: b.branch_head ?? b.head ?? '',
    status: String(b.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive',
    employeesCount: Number(b.employees_count ?? b.employee_count ?? 0),
  };
}
/** GET /super-admin/branches (falls back to /branches on 403 / 404, like the web). */
export async function listBranches(companyId) {
  const params = companyId ? { company_id: companyId } : {};
  let res;
  try {
    res = await api.get('/super-admin/branches', { params });
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404 || status === 403) res = await api.get('/branches', { params });
    else throw err;
  }
  return rowsOf(res.data, 'branches', 'data').map(branchFromApi);
}
export const getBranch = async (id) =>
  branchFromApi(unwrap((await api.get(`/super-admin/branches/${encodeURIComponent(id)}`)).data) ?? {});
/** GET /super-admin/companies (org-level, never scoped). */
export async function listCompanies() {
  const { data } = await api.get('/super-admin/companies');
  return rowsOf(data, 'companies', 'data').map((c) => ({
    id: String(c.id),
    name: c.name ?? c.legal_name ?? '',
    code: c.code ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
  }));
}
const issued = (data, fallback = {}) =>
  data?.temporary_password
    ? {
        name: data.branch_admin?.full_name ?? fallback.name ?? '',
        email: data.branch_admin?.email ?? fallback.email ?? '',
        temporaryPassword: data.temporary_password,
        emailSent: Boolean(data.email_sent),
        replaced: Boolean(data.replaced),
      }
    : null;
export async function createBranch(payload) {
  const data = unwrap((await api.post('/super-admin/branches', payload)).data);
  return issued(data, { name: payload.admin_name, email: payload.admin_email });
}
export const updateBranch = async (id, payload) =>
  (await api.put(`/super-admin/branches/${encodeURIComponent(id)}`, payload)).data;
export const deleteBranch = async (id) => (await api.delete(`/super-admin/branches/${encodeURIComponent(id)}`)).data;
/** POST /super-admin/branches/{id}/admin — creates or replaces the Branch Admin (old one deactivated). */
export async function setBranchAdmin(id, body) {
  const data = unwrap((await api.post(`/super-admin/branches/${encodeURIComponent(id)}/admin`, body)).data);
  return (
    issued(data, { name: body.admin_name, email: body.admin_email }) ?? {
      name: body.admin_name,
      email: body.admin_email,
      emailSent: Boolean(data?.email_sent),
      replaced: Boolean(data?.replaced),
    }
  );
}
/** POST /super-admin/branches/{id}/admin/reset-password — new temporary password, shown once. */
export async function resetBranchAdminPassword(id, branchName) {
  const data = unwrap((await api.post(`/super-admin/branches/${encodeURIComponent(id)}/admin/reset-password`)).data);
  const admin = data?.branch_admin ?? {};
  return {
    name: admin.full_name ?? branchName,
    email: admin.email ?? '',
    temporaryPassword: data?.temporary_password,
    emailSent: Boolean(data?.email_sent),
  };
}
