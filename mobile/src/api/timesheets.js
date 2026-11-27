import { api } from '@/lib/api';
/** Same endpoints as the web app (src/api/timesheetApi.js). */
const BASE = '/timesheets';
const unwrap = (res) => res?.data ?? res;
/** KPI cards + day-grouped history: { kpis: {...}, grouped_history: [{ date, day_hours, verdict, entries: [...] }] } */
export const getMyTimesheetSummary = async (params = {}) => unwrap((await api.get(`${BASE}/me`, { params })).data);
export const getMyTimesheetEntries = async (params = {}) =>
  unwrap((await api.get(`${BASE}/me/entries`, { params: { page: 1, limit: 50, ...params } })).data);
export const batchFillTimesheet = async (body) =>
  (await api.post(`${BASE}/me/entries`, { format_name: 'Default', status: 'Submitted', ...body })).data;
export const correctAndResubmit = async (entryId, payload) =>
  (await api.put(`${BASE}/me/entries/${entryId}`, payload)).data;
export const submitDraft = async (entryId) => (await api.post(`${BASE}/me/entries/${entryId}/submit`)).data;
export const deleteDraft = async (entryId) => (await api.delete(`${BASE}/me/entries/${entryId}`)).data;
/** { statuses, task_statuses, projects, contracted_hours } */
export const getTimesheetMeta = async () => unwrap((await api.get(`${BASE}/meta`)).data);
/** [{ name, frequency: 'Daily' | 'Weekly', fields: ['Start Time', 'End Time', ...] }] */
export const getTimesheetFormats = async () => {
  const d = unwrap((await api.get(`${BASE}/formats`)).data);
  return Array.isArray(d) ? d : [];
};
/**
 * GET /timesheets/me/ytd?upto=YYYY-MM-DD — Financial-year (Apr–Mar) analytics:
 * { fy_label, total_hours, billable_hours, avg_per_day, approved_pct, months: [...], by_project: [{ project, hours }] }
 */
export const getMyTimesheetYtd = async (upto) =>
  unwrap((await api.get(`${BASE}/me/ytd`, { params: upto ? { upto } : {} })).data);
/**
 * POST /timesheets/entries/{id}/decision  body { action: 'APPROVE' | 'REJECT', remarks } — manager (direct reports)
 * or HR / admin. Remarks are required to reject. Returns the updated entry.
 */
export const reviewTimesheetEntry = async (entryId, { action, remarks = '' }) =>
  unwrap(
    (await api.post(`${BASE}/entries/${encodeURIComponent(String(entryId))}/decision`, { action, remarks })).data,
  );
