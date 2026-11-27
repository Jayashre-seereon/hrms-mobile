import { api } from '@/lib/api';

import { clean, rowsOf } from './common';

/** Payroll runs — same endpoints as the web payrollRunApi (src/api/payrollRunApi.js). Read + approve/reject only. */
const run = (id: string) => `/payroll/runs/${encodeURIComponent(id)}`;

export async function listPayrollRuns(params: Record<string, any> = {}) {
  const { data } = await api.get('/payroll/runs', { params: clean({ page: 1, limit: 50, ...params }) });
  return rowsOf(data).sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1));
}

export const getPayrollRun = async (id: string) => (await api.get(run(id))).data as Record<string, any>;

/** POST /payroll/runs/{id}/approvals { decision: "approve" | "reject", remarks } — needs payroll.approve. */
export const decidePayrollRun = async (id: string, decision: 'approve' | 'reject', remarks: string) =>
  (await api.post(`${run(id)}/approvals`, { decision, remarks })).data;
