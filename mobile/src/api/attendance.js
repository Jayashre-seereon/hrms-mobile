import { api } from '@/lib/api';
/** Same endpoints as the web app (src/api/attendanceApi.js — employee self-service part). */
const BASE = '/attendance';
export const getTodayStatus = async () => (await api.get(`${BASE}/today`)).data;
export const punchIn = async (payload = {}) =>
  (await api.post(`${BASE}/punch-in`, { source: 'MANUAL', device_id: null, location_name: null, note: '', ...payload }))
    .data;
export const punchOut = async (payload = {}) => (await api.post(`${BASE}/punch-out`, { note: '', ...payload })).data;
export const getMySummary = async (month, year) =>
  (await api.get(`${BASE}/my-summary`, { params: { ...(month ? { month } : {}), ...(year ? { year } : {}) } })).data;
export const getMyPunches = async ({ month, year, page = 1, limit = 50 } = {}) => {
  const { data } = await api.get(`${BASE}/my-punches`, { params: { month, year, page, limit } });
  return Array.isArray(data) ? data : (data?.items ?? []);
};
/** List helper: the backend answers either a plain array or { items: [...] }. */
export const itemsOf = (res) => (Array.isArray(res) ? res : (res?.items ?? res?.employees ?? res?.data ?? []));
// ── Missed punch-out regularisation (employee side + approver queue) ──
export const createRegularisation = async (body) => (await api.post(`${BASE}/regularisation-requests`, body)).data;
export const getMyRegularisations = async (params = {}) =>
  itemsOf((await api.get(`${BASE}/regularisation-requests/mine`, { params })).data);
export const withdrawRegularisation = async (id) => (await api.delete(`${BASE}/regularisation-requests/${id}`)).data;
export const getRegularisationQueue = async (params = {}) =>
  itemsOf((await api.get(`${BASE}/regularisation-requests`, { params: { page: 1, limit: 50, ...params } })).data);
export const decideRegularisation = async (id, body) =>
  (await api.post(`${BASE}/regularisation-requests/${id}/decision`, body)).data;
// ── HR direct correction ──
export const listPunches = async (params = {}) => itemsOf((await api.get(`${BASE}/punches`, { params })).data);
export const addPunch = async (body) => (await api.post(`${BASE}/punches`, body)).data;
export const regularisePunch = async (id, body) => (await api.post(`${BASE}/punches/${id}/regularise`, body)).data;
/** Employees for the correction form (same call as the web: GET /employees?page=1&limit=100). */
export const getEmployeesForPicker = async () =>
  itemsOf((await api.get('/employees', { params: { page: 1, limit: 100 } })).data);
export const getMyCompOffSummary = async () => {
  const res = (await api.get('/leave/compoff/me')).data;
  return res?.data ?? res ?? {};
};
export const submitCompOffRedemption = async (body) => (await api.post('/leave/compoff/redemptions', body)).data;
export const withdrawCompOffRedemption = async (id) => (await api.delete(`/leave/compoff/redemptions/${id}`)).data;
