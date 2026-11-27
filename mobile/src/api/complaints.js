import { api } from '@/lib/api';
/** Same endpoints as the web app (src/api/grievanceApi.js — employee self-service /me/grievances). */
const unwrap = (data) => data?.data ?? data;
export const GRIEVANCE_CATEGORIES = [
  'Harassment (POSH)',
  'Discrimination',
  'Workplace safety',
  'Payroll / salary dispute',
  'Leave / attendance',
  'Manager behaviour',
  'Facilities',
  'Policy violation',
  'Other',
];
export const GRIEVANCE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export async function getMyGrievances({ page = 1, pageSize = 50, status, search } = {}) {
  const params = { page, pageSize };
  if (status && status !== 'all') params.status = status;
  if (search) params.search = search;
  const res = unwrap((await api.get('/me/grievances', { params })).data);
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}
export const submitGrievance = async (payload) => unwrap((await api.post('/me/grievances', payload)).data);
export const getMyGrievanceDetail = async (id) =>
  unwrap((await api.get(`/me/grievances/${encodeURIComponent(id)}`)).data);
export const withdrawGrievance = async (id) =>
  unwrap((await api.post(`/me/grievances/${encodeURIComponent(id)}/withdraw`, {})).data);
export const closeGrievance = async (id, { rating, feedback }) =>
  unwrap(
    (
      await api.post(`/me/grievances/${encodeURIComponent(id)}/close`, {
        rating: Number(rating),
        feedback: feedback?.trim() || undefined,
      })
    ).data,
  );
export const appealGrievance = async (id, reason) =>
  unwrap((await api.post(`/me/grievances/${encodeURIComponent(id)}/appeal`, { reason: reason.trim() })).data);
