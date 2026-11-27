import { api } from '@/lib/api';
import { rowsOf, unwrap } from './common';
/**
 * Compliance masters — same endpoints / payloads as the web (src/api/attendance_pattern.js +
 * features/attendance/data/attendanceMasterAdapters.js), used by the web /org/compliance screen.
 * Scope (organization / company) comes from the token / X-Company-Id (lib/scope.js strips scope keys on masters).
 */
const PATTERNS = '/attendance/patterns';
const TIMESHEETS = '/attendance-and-time/timesheet-formats';
const LIST_PARAMS = { page: 1, page_size: 100 };
const t = (v) => String(v ?? '').trim();
const enc = (id) => encodeURIComponent(String(id));

/* ---------- attendance patterns ---------- */
/** API record → form/list shape (web fromApi). */
export const patternFromApi = (r = {}) => ({
  id: String(r.id ?? ''),
  code: r.code ?? '',
  name: r.name ?? '',
  workingDays: Number(r.working_days_per_month ?? 0),
  paidLeaveDays: Number(r.paid_absences_per_month ?? 0),
  weeklyOffs: Number(r.weekly_offs_per_month ?? 0),
  lopEnabled: Boolean(r.deduct_beyond_paid_days),
  description: r.description ?? '',
  status: r.is_active === false ? 'Inactive' : 'Active',
  employees: Number(r.assigned_employee_count ?? 0),
});
/** Full body for POST / PUT (web toPayload). */
export const patternPayload = (f) => ({
  name: t(f.name),
  working_days_per_month: Number(f.workingDays),
  paid_absences_per_month: Number(f.paidLeaveDays),
  weekly_offs_per_month: Number(f.weeklyOffs),
  deduct_beyond_paid_days: Boolean(f.lopEnabled),
  description: t(f.description),
});
/** Only the changed fields (web toPatchPayload). */
export function patternPatch(f, o = {}) {
  const p = {};
  if (t(f.name) !== t(o.name)) p.name = t(f.name);
  if (Number(f.workingDays) !== Number(o.workingDays)) p.working_days_per_month = Number(f.workingDays);
  if (Number(f.paidLeaveDays) !== Number(o.paidLeaveDays)) p.paid_absences_per_month = Number(f.paidLeaveDays);
  if (Number(f.weeklyOffs) !== Number(o.weeklyOffs)) p.weekly_offs_per_month = Number(f.weeklyOffs);
  if (Boolean(f.lopEnabled) !== Boolean(o.lopEnabled)) p.deduct_beyond_paid_days = Boolean(f.lopEnabled);
  if (t(f.description) !== t(o.description)) p.description = t(f.description);
  return p;
}
/** GET /attendance/patterns */
export async function listPatterns() {
  const { data } = await api.get(PATTERNS, { params: LIST_PARAMS });
  return rowsOf(data)
    .filter((r) => r && typeof r === 'object')
    .map(patternFromApi);
}
/** GET /attendance/patterns/{id} */
export async function getPattern(id) {
  return patternFromApi(unwrap((await api.get(`${PATTERNS}/${enc(id)}`)).data));
}
/** POST /attendance/patterns */
export async function createPattern(form) {
  return unwrap((await api.post(PATTERNS, patternPayload(form))).data);
}
/** PUT /attendance/patterns/{id} — full replace. */
export async function updatePattern(id, form) {
  return unwrap((await api.put(`${PATTERNS}/${enc(id)}`, patternPayload(form))).data);
}
/** PATCH /attendance/patterns/{id} with only the changed fields; no request when nothing changed (web). */
export async function patchPattern(id, form, original) {
  const patch = patternPatch(form, original);
  if (!Object.keys(patch).length) return null;
  return unwrap((await api.patch(`${PATTERNS}/${enc(id)}`, patch)).data);
}
/** DELETE /attendance/patterns/{id} */
export async function deletePattern(id) {
  return (await api.delete(`${PATTERNS}/${enc(id)}`)).data;
}

/* ---------- timesheet formats ---------- */
export const TIMESHEET_FREQUENCIES = ['Daily', 'Weekly', 'Monthly'];
/** web features/timesheets/data/timesheet-data.js TIMESHEET_FIELDS */
export const TIMESHEET_FIELDS = [
  'Task Name',
  'Description',
  'Start Time',
  'End Time',
  'Hours',
  'Status',
  'Project',
  'Billable',
];
export const DEFAULT_TIMESHEET_FIELDS = ['Task Name', 'Description', 'Start Time', 'End Time', 'Hours', 'Status'];
/** web finance-data.js DEPARTMENT_NAMES (the web dropdown list). */
export const TIMESHEET_DEPARTMENTS = ['Engineering', 'Sales', 'Human Resources', 'Finance', 'Operations', 'Marketing'];
export const ALL_DEPARTMENTS = 'All departments';

export const timesheetFromApi = (r = {}) => ({
  id: String(r.id ?? ''),
  code: r.code ?? '',
  name: r.format_name ?? '',
  frequency: r.frequency ?? '',
  department: r.department || ALL_DEPARTMENTS,
  fields: Array.isArray(r.fields) ? r.fields : [],
  description: r.description ?? '',
  active: r.is_active ?? true,
});
export const timesheetPayload = (f) => ({
  format_name: t(f.name),
  frequency: f.frequency,
  department: t(f.department) || ALL_DEPARTMENTS,
  fields: f.fields ?? [],
  description: t(f.description),
  is_active: f.active ?? true,
});
/** GET /attendance-and-time/timesheet-formats */
export async function listTimesheetFormats() {
  const { data } = await api.get(TIMESHEETS, { params: LIST_PARAMS });
  return rowsOf(data)
    .filter((r) => r && typeof r === 'object')
    .map(timesheetFromApi);
}
/** GET /attendance-and-time/timesheet-formats/{id} */
export async function getTimesheetFormat(id) {
  return timesheetFromApi(unwrap((await api.get(`${TIMESHEETS}/${enc(id)}`)).data));
}
/** POST /attendance-and-time/timesheet-formats */
export async function createTimesheetFormat(form) {
  return unwrap((await api.post(TIMESHEETS, timesheetPayload(form))).data);
}
/** PUT /attendance-and-time/timesheet-formats/{id} — the web edit dialog always PUTs the full body. */
export async function updateTimesheetFormat(id, form) {
  return unwrap((await api.put(`${TIMESHEETS}/${enc(id)}`, timesheetPayload(form))).data);
}
/** PATCH /attendance-and-time/timesheet-formats/{id} { is_active } — the web Active switch. */
export async function setTimesheetFormatActive(id, isActive) {
  return unwrap((await api.patch(`${TIMESHEETS}/${enc(id)}`, { is_active: isActive })).data);
}
/** DELETE /attendance-and-time/timesheet-formats/{id} */
export async function deleteTimesheetFormat(id) {
  return (await api.delete(`${TIMESHEETS}/${enc(id)}`)).data;
}
