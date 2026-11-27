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
