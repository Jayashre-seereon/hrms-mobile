import { api } from '@/lib/api';

import { rowsOf, unwrap } from './common';

const clean = (v: unknown) => String(v ?? '').trim();

/* ---------- performance indicator category id (web performanceIndicatorAdapter.resolveCategoryId) ---------- */
export async function findPerformanceCategoryId(categoryName: string): Promise<string | undefined> {
  const wanted = clean(categoryName).toLowerCase();
  if (!wanted) return undefined;
  try {
    const { data } = await api.get('/performance-indicators/categories');
    const list = rowsOf(data, 'data', 'categories');
    const match = list.find((item: any) => {
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
const TYPE_TO_API: Record<string, string> = {
  National: 'NATIONAL',
  'Regional / State': 'REGIONAL_STATE',
  'Optional / Restricted': 'OPTIONAL_RESTRICTED',
};
const TYPE_FROM_API = Object.fromEntries(Object.entries(TYPE_TO_API).map(([ui, apiValue]) => [apiValue, ui]));
const CAT_TO_API: Record<string, string> = { Paid: 'PAID', Unpaid: 'UNPAID' };
const CAT_FROM_API: Record<string, string> = { PAID: 'Paid', UNPAID: 'Unpaid' };

export type Holiday = { date: string; name: string };
export type HolidayCalendar = {
  id: string;
  name: string;
  type: string;
  year: number;
  payType: string;
  holidays: Holiday[];
  uploadedFile?: string;
};

export function calendarFromApi(r: any): HolidayCalendar {
  return {
    id: String(r?.id ?? ''),
    name: r?.holiday_title ?? '',
    type: TYPE_FROM_API[String(r?.type ?? '').toUpperCase()] ?? r?.type ?? '',
    year: Number(r?.year ?? new Date().getFullYear()),
    payType: CAT_FROM_API[String(r?.leave_category ?? '').toUpperCase()] ?? 'Paid',
    holidays: (Array.isArray(r?.holidays) ? r.holidays : []).map((h: any) => ({
      date: h.holiday_date ?? '',
      name: h.holiday_name ?? '',
    })),
    uploadedFile: r?.csv_file_name ?? '',
  };
}

const calendarPayload = (c: Omit<HolidayCalendar, 'id'>) => ({
  holiday_title: clean(c.name),
  type: TYPE_TO_API[c.type] ?? c.type,
  year: Number(c.year),
  leave_category: CAT_TO_API[c.payType] ?? 'PAID',
  holidays: (c.holidays ?? []).map((h) => ({ holiday_date: h.date, holiday_name: clean(h.name) })),
});

export const listHolidayCalendars = async () =>
  rowsOf((await api.get(HC, { params: { page: 1, page_size: 100 } })).data, 'data').map(calendarFromApi);

export const getHolidayCalendar = async (id: string) =>
  calendarFromApi(unwrap((await api.get(`${HC}/${encodeURIComponent(id)}`)).data) ?? {});

export const createHolidayCalendar = async (c: Omit<HolidayCalendar, 'id'>) => (await api.post(HC, calendarPayload(c))).data;

export const updateHolidayCalendar = async (id: string, c: Omit<HolidayCalendar, 'id'>) =>
  (await api.put(`${HC}/${encodeURIComponent(id)}`, calendarPayload(c))).data;

export const deleteHolidayCalendar = async (id: string) => (await api.delete(`${HC}/${encodeURIComponent(id)}`)).data;

/** POST /upload — the backend creates one calendar per Holiday Title + Year from the Excel file. */
export async function uploadHolidayCalendars(file: { uri: string; name: string; mimeType?: string | null }) {
  const fd = new FormData();
  fd.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as any);
  const { data } = await api.post(`${HC}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return rowsOf(data, 'data').map(calendarFromApi);
}

/** Same checks as the web calendarError (ConfigHubTabs.jsx). */
export function calendarError(c: Omit<HolidayCalendar, 'id'>, nameError: (v: unknown, label: string) => string): string | null {
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

/* ---------- branches (web api/branch.js + TenantStructure.jsx) ---------- */
export type Branch = {
  id: string;
  companyId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  isHq: boolean;
  head: string;
  status: 'Active' | 'Inactive';
  employeesCount: number;
};

export function branchFromApi(b: any): Branch {
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
export async function listBranches(companyId?: string | null) {
  const params = companyId ? { company_id: companyId } : {};
  let res;
  try {
    res = await api.get('/super-admin/branches', { params });
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404 || status === 403) res = await api.get('/branches', { params });
    else throw err;
  }
  return rowsOf(res.data, 'branches', 'data').map(branchFromApi);
}

export const getBranch = async (id: string) =>
  branchFromApi(unwrap((await api.get(`/super-admin/branches/${encodeURIComponent(id)}`)).data) ?? {});

export type Company = { id: string; name: string; code: string; city?: string; state?: string };

/** GET /super-admin/companies (org-level, never scoped). */
export async function listCompanies(): Promise<Company[]> {
  const { data } = await api.get('/super-admin/companies');
  return rowsOf(data, 'companies', 'data').map((c: any) => ({
    id: String(c.id),
    name: c.name ?? c.legal_name ?? '',
    code: c.code ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
  }));
}

/** Issued credentials returned by create-with-admin / set admin / reset password (shown once). */
export type IssuedAdmin = { name: string; email: string; temporaryPassword?: string; emailSent: boolean; replaced?: boolean };

const issued = (data: any, fallback: { name?: string; email?: string } = {}): IssuedAdmin | null =>
  data?.temporary_password
    ? {
        name: data.branch_admin?.full_name ?? fallback.name ?? '',
        email: data.branch_admin?.email ?? fallback.email ?? '',
        temporaryPassword: data.temporary_password,
        emailSent: Boolean(data.email_sent),
        replaced: Boolean(data.replaced),
      }
    : null;

export async function createBranch(payload: Record<string, any>) {
  const data = unwrap((await api.post('/super-admin/branches', payload)).data);
  return issued(data, { name: payload.admin_name, email: payload.admin_email });
}

export const updateBranch = async (id: string, payload: Record<string, any>) =>
  (await api.put(`/super-admin/branches/${encodeURIComponent(id)}`, payload)).data;

export const deleteBranch = async (id: string) => (await api.delete(`/super-admin/branches/${encodeURIComponent(id)}`)).data;

/** POST /super-admin/branches/{id}/admin — creates or replaces the Branch Admin (old one deactivated). */
export async function setBranchAdmin(id: string, body: { admin_name: string; admin_email: string; admin_phone: string }) {
  const data = unwrap((await api.post(`/super-admin/branches/${encodeURIComponent(id)}/admin`, body)).data);
  return issued(data, { name: body.admin_name, email: body.admin_email }) ?? { name: body.admin_name, email: body.admin_email, emailSent: Boolean(data?.email_sent), replaced: Boolean(data?.replaced) };
}

/** POST /super-admin/branches/{id}/admin/reset-password — new temporary password, shown once. */
export async function resetBranchAdminPassword(id: string, branchName: string) {
  const data = unwrap((await api.post(`/super-admin/branches/${encodeURIComponent(id)}/admin/reset-password`)).data);
  const admin = data?.branch_admin ?? {};
  return {
    name: admin.full_name ?? branchName,
    email: admin.email ?? '',
    temporaryPassword: data?.temporary_password,
    emailSent: Boolean(data?.email_sent),
  } as IssuedAdmin;
}
