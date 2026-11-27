import { api } from '@/lib/api';
import { unwrap } from './common';
/**
 * Companies (Super Admin) — same endpoints / bodies as the web src/api/company.js, used by /org/groups
 * (TenantStructure CompanyDialog) and /org/company-modules (OrgLevelScreens). These URLs are organisation level:
 * lib/scope.js never sends X-Company-Id with /super-admin/companies, /companies or /org/dashboard.
 */
const enc = (id) => encodeURIComponent(String(id));
const listOf = (body) => {
  const d = unwrap(body) ?? [];
  return Array.isArray(d) ? d : (d.items ?? d.companies ?? d.cards ?? d.data ?? []);
};

/* ---------- module catalogue (web src/config/modules.js) ---------- */
export const CORE_MODULES = ['employee', 'attendance', 'leave', 'payroll', 'documents'];
export const OPTIONAL_MODULES = [
  'performance',
  'recruitment',
  'learning',
  'engagement',
  'expense',
  'tours',
  'assets',
  'helpdesk',
  'compliance',
  'analytics',
  'exit',
];
const LABELS = {
  employee: 'Employee',
  attendance: 'Attendance & Shifts',
  leave: 'Leave',
  payroll: 'Payroll',
  documents: 'Documents',
  performance: 'Performance',
  recruitment: 'Recruitment',
  learning: 'Learning & Training',
  engagement: 'Engagement',
  expense: 'Expense & Claims',
  tours: 'Tours & Travel',
  assets: 'Assets',
  helpdesk: 'Helpdesk',
  compliance: 'Compliance',
  analytics: 'Reports & Analytics',
  exit: 'Exit',
};
export const moduleLabel = (key) => LABELS[key] ?? String(key).replace(/^./, (c) => c.toUpperCase());
/** Optional keys among a company's enabled modules (core and unknown keys dropped). */
export const optionalOf = (modules) =>
  (Array.isArray(modules) ? modules : [])
    .map((m) => (typeof m === 'string' ? m : (m?.key ?? m?.module_key)))
    .filter((k) => OPTIONAL_MODULES.includes(k));

/* ---------- companies ---------- */
/** GET /super-admin/companies, falling back to GET /companies on 403 / 404 (web getCompanies). */
export async function listCompanies() {
  try {
    return listOf((await api.get('/super-admin/companies')).data);
  } catch (err) {
    if (err?.response?.status === 404 || err?.response?.status === 403) {
      return listOf((await api.get('/companies')).data);
    }
    throw err;
  }
}
/** GET /super-admin/companies/{id} */
export async function getCompany(id) {
  return unwrap((await api.get(`/super-admin/companies/${enc(id)}`)).data);
}
/** POST /super-admin/companies → { company, company_admin, temporary_password, email_sent, message } */
export async function createCompany(body) {
  const { data } = await api.post('/super-admin/companies', body);
  return { ...(unwrap(data) ?? {}), message: data?.message };
}
/** PUT /super-admin/companies/{id} */
export async function updateCompany(id, body) {
  return unwrap((await api.put(`/super-admin/companies/${enc(id)}`, body)).data);
}
/** DELETE /super-admin/companies/{id} (fails when employees are assigned). */
export async function deleteCompany(id) {
  return (await api.delete(`/super-admin/companies/${enc(id)}`)).data;
}
/** POST /super-admin/companies/{id}/admin/reset-password → { company_admin, temporary_password, email_sent } */
export async function resetCompanyAdminPassword(id) {
  return unwrap((await api.post(`/super-admin/companies/${enc(id)}/admin/reset-password`)).data) ?? {};
}
/** GET /companies/{id}/modules → { core, optional, enabled, available_optional } */
export async function getCompanyModules(id) {
  const d = unwrap((await api.get(`/companies/${enc(id)}/modules`)).data) ?? {};
  return {
    core: Array.isArray(d.core) && d.core.length ? d.core : CORE_MODULES,
    optional: optionalOf(d.optional ?? d.optional_modules ?? d.enabled_modules),
    available:
      Array.isArray(d.available_optional) && d.available_optional.length ? d.available_optional : OPTIONAL_MODULES,
  };
}
/** PUT /companies/{id}/modules { modules } — replaces the optional set; core keys are never sent. */
export async function updateCompanyModules(id, modules) {
  return unwrap((await api.put(`/companies/${enc(id)}/modules`, { modules })).data);
}

/* ---------- organisation dashboard ---------- */
const n = (...v) => Number(v.find((x) => x !== undefined && x !== null) ?? 0) || 0;
/**
 * One card per company: GET /org/dashboard, or the company list counts when the server has no such route
 * (404 / 405) — same as the web useOrgCards().
 */
export async function getOrgDashboardCards() {
  let rows;
  try {
    rows = listOf((await api.get('/org/dashboard')).data);
  } catch (e) {
    if (![404, 405].includes(e?.response?.status)) throw e;
    rows = await listCompanies();
  }
  return rows.map((c) => {
    const total = n(c.employees, c.total_employees, c.employee_count, c.employees_count);
    const trend = (c.headcount_trend ?? c.trend ?? []).map((x) =>
      typeof x === 'number' ? x : n(x?.count, x?.headcount, x?.value),
    );
    return {
      id: String(c.id ?? c.company_id ?? ''),
      name: c.name ?? c.company_name ?? 'Company',
      code: c.code ?? '',
      active: !(c.is_active === false || String(c.status ?? '').toLowerCase() === 'inactive'),
      employees: total,
      activeEmployees: n(c.active_employees, c.active, c.active_count, total),
      branches: n(c.branches, c.branch_count, c.branches_count),
      trend,
    };
  });
}
