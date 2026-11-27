import { api } from '@/lib/api';

/** Same endpoints as the web app (src/api/attendanceApi.js — employee self-service part). */
const BASE = '/attendance';

export type TodayStatus = {
  date?: string;
  is_punched_in?: boolean;
  locked?: boolean;
  shift?: { name?: string; start_time?: string; end_time?: string } | null;
  active_punch?: { date?: string; in_time?: string } | null;
  missed_punch_outs?: unknown[];
  [key: string]: unknown;
};

export const getTodayStatus = async (): Promise<TodayStatus> => (await api.get(`${BASE}/today`)).data;

export const punchIn = async (payload: { source?: string; location_name?: string | null; note?: string } = {}) =>
  (await api.post(`${BASE}/punch-in`, { source: 'MANUAL', device_id: null, location_name: null, note: '', ...payload }))
    .data;

export const punchOut = async (payload: { note?: string } = {}) =>
  (await api.post(`${BASE}/punch-out`, { note: '', ...payload })).data;

export const getMySummary = async (month?: number, year?: number) =>
  (await api.get(`${BASE}/my-summary`, { params: { ...(month ? { month } : {}), ...(year ? { year } : {}) } })).data;

export const getMyPunches = async ({ month, year, page = 1, limit = 50 }: { month?: number; year?: number; page?: number; limit?: number } = {}) => {
  const { data } = await api.get(`${BASE}/my-punches`, { params: { month, year, page, limit } });
  return (Array.isArray(data) ? data : (data?.items ?? [])) as Record<string, any>[];
};

/** List helper: the backend answers either a plain array or { items: [...] }. */
export const itemsOf = (res: any): Record<string, any>[] =>
  Array.isArray(res) ? res : (res?.items ?? res?.employees ?? res?.data ?? []);

// ── Missed punch-out regularisation (employee side + approver queue) ──
export const createRegularisation = async (body: {
  punch_id?: string | number;
  date?: string;
  requested_out_time: string;
  next_day: boolean;
  reason: string;
}) => (await api.post(`${BASE}/regularisation-requests`, body)).data;

export const getMyRegularisations = async (params: Record<string, any> = {}) =>
  itemsOf((await api.get(`${BASE}/regularisation-requests/mine`, { params })).data);

export const withdrawRegularisation = async (id: string | number) =>
  (await api.delete(`${BASE}/regularisation-requests/${id}`)).data;

export const getRegularisationQueue = async (params: { status?: string; page?: number; limit?: number } = {}) =>
  itemsOf((await api.get(`${BASE}/regularisation-requests`, { params: { page: 1, limit: 50, ...params } })).data);

export const decideRegularisation = async (
  id: string | number,
  body: { action: 'approve' | 'reject'; reason?: string; approved_out_time?: string },
) => (await api.post(`${BASE}/regularisation-requests/${id}/decision`, body)).data;

// ── HR direct correction ──
export const listPunches = async (params: Record<string, any> = {}) =>
  itemsOf((await api.get(`${BASE}/punches`, { params })).data);

export const addPunch = async (body: {
  employee_id: string | number;
  date: string;
  in_time: string;
  out_time: string;
  next_day: boolean;
  reason: string;
}) => (await api.post(`${BASE}/punches`, body)).data;

export const regularisePunch = async (
  id: string | number,
  body: { out_time: string; in_time?: string; next_day: boolean; reason: string },
) => (await api.post(`${BASE}/punches/${id}/regularise`, body)).data;

/** Employees for the correction form (same call as the web: GET /employees?page=1&limit=100). */
export const getEmployeesForPicker = async () =>
  itemsOf((await api.get('/employees', { params: { page: 1, limit: 100 } })).data);

// ── Comp-off (served by the leave module: /leave/compoff/*) ──
export type CompOffSummary = {
  earned?: number;
  redeemed?: number;
  available?: number;
  redemptions?: Record<string, any>[];
  [key: string]: unknown;
};

export const getMyCompOffSummary = async (): Promise<CompOffSummary> => {
  const res = (await api.get('/leave/compoff/me')).data;
  return res?.data ?? res ?? {};
};

export const submitCompOffRedemption = async (body: {
  from_date: string;
  to_date: string;
  half_day: boolean;
  reason: string;
}) => (await api.post('/leave/compoff/redemptions', body)).data;

export const withdrawCompOffRedemption = async (id: string | number) =>
  (await api.delete(`/leave/compoff/redemptions/${id}`)).data;
