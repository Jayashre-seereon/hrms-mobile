import { api } from '@/lib/api';
import { clean, rowsOf, unwrap } from './common';
/** HR side of grievances — same endpoints as the web grievanceApi (src/api/grievanceApi.js). */
const g = (id) => `/grievances/${encodeURIComponent(id)}`;
/** Status flow: Submitted → Acknowledged → Under investigation → Resolved → Closed (also Appealed / Withdrawn). */
export const GRIEVANCE_STATUSES = [
  'Submitted',
  'Acknowledged',
  'Under investigation',
  'Resolved',
  'Appealed',
  'Closed',
  'Withdrawn',
];
export async function listGrievances(params = {}) {
  const { data } = await api.get('/grievances', {
    params: clean({ page: 1, pageSize: 100, ...params, overdue: params.overdue ? true : undefined }),
  });
  return rowsOf(data);
}
export const getGrievanceStats = async () => unwrap((await api.get('/grievances/stats')).data);
export const getGrievance = async (id) => unwrap((await api.get(g(id))).data);
export const acknowledgeGrievance = async (id, body = {}) =>
  unwrap(
    (
      await api.post(`${g(id)}/acknowledge`, {
        ownerName: body.ownerName || undefined,
        committee: body.committee || undefined,
      })
    ).data,
  );
export const addGrievanceNote = async (id, note, visibleToEmployee = true) =>
  unwrap((await api.post(`${g(id)}/notes`, { note: note.trim(), visibleToEmployee })).data);
export const resolveGrievance = async (id, resolution, actionTaken) =>
  unwrap(
    (
      await api.post(`${g(id)}/resolve`, {
        resolution: resolution.trim(),
        actionTaken: actionTaken?.trim() || undefined,
      })
    ).data,
  );
/** Only allowed after the 7-day confirmation window — the backend refuses earlier. */
export const closeGrievance = async (id) => unwrap((await api.post(`${g(id)}/close`, {})).data);
