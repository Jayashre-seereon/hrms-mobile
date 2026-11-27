import { api } from '@/lib/api';
import { clean, rowsOf } from './common';
/** Payroll runs — same endpoints as the web payrollRunApi (src/api/payrollRunApi.js). Read + approve/reject only. */
const run = (id) => `/payroll/runs/${encodeURIComponent(id)}`;
export async function listPayrollRuns(params = {}) {
  const { data } = await api.get('/payroll/runs', { params: clean({ page: 1, limit: 50, ...params }) });
  return rowsOf(data).sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1));
}
export const getPayrollRun = async (id) => (await api.get(run(id))).data;
/** POST /payroll/runs/{id}/approvals { decision: "approve" | "reject", remarks } — needs payroll.approve. */
export const decidePayrollRun = async (id, decision, remarks) =>
  (await api.post(`${run(id)}/approvals`, { decision, remarks })).data;
