import { api } from '@/lib/api';

/** Same endpoints as the web app (src/api/timesheetApi.js). */
const BASE = '/timesheets';

const unwrap = (res: any) => res?.data ?? res;

export type TimesheetTask = {
  project: string;
  billable: boolean;
  task: string;
  description: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  task_status: string;
};

/** KPI cards + day-grouped history: { kpis: {...}, grouped_history: [{ date, day_hours, verdict, entries: [...] }] } */
export const getMyTimesheetSummary = async (params: { from_date?: string; to_date?: string } = {}) =>
  unwrap((await api.get(`${BASE}/me`, { params })).data) as Record<string, any>;

export const getMyTimesheetEntries = async (params: Record<string, any> = {}) =>
  unwrap((await api.get(`${BASE}/me/entries`, { params: { page: 1, limit: 50, ...params } })).data);

export const batchFillTimesheet = async (body: {
  format_name?: string;
  status?: 'Draft' | 'Submitted';
  days: { date: string; tasks: TimesheetTask[] }[];
}) => (await api.post(`${BASE}/me/entries`, { format_name: 'Default', status: 'Submitted', ...body })).data;

export const correctAndResubmit = async (entryId: string | number, payload: TimesheetTask) =>
  (await api.put(`${BASE}/me/entries/${entryId}`, payload)).data;

export const submitDraft = async (entryId: string | number) =>
  (await api.post(`${BASE}/me/entries/${entryId}/submit`)).data;

export const deleteDraft = async (entryId: string | number) =>
  (await api.delete(`${BASE}/me/entries/${entryId}`)).data;

/** { statuses, task_statuses, projects, contracted_hours } */
export const getTimesheetMeta = async () => unwrap((await api.get(`${BASE}/meta`)).data) as Record<string, any>;

/** [{ name, frequency: 'Daily' | 'Weekly', fields: ['Start Time', 'End Time', ...] }] */
export const getTimesheetFormats = async () => {
  const d = unwrap((await api.get(`${BASE}/formats`)).data);
  return (Array.isArray(d) ? d : []) as Record<string, any>[];
};
