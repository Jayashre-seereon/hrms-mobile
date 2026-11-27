import { api } from '@/lib/api';
import { getAttendanceSummary } from './attendance';
import { num, rowsOf, unwrap } from './common';
import { getGrievanceStats } from './grievances';
import { listPayrollRuns } from './payroll';
/**
 * Company Admin dashboard cards — same calls as the web dashboardApi / dashboardAdapter.
 * Each card loads on its own; a failing call gives `null` for that card only.
 */
export async function headcount() {
  const { data } = await api.get('/employees', { params: { page: 1, limit: 1 } });
  const d = unwrap(data);
  return Array.isArray(d) ? d.length : num(d?.total ?? d?.count ?? rowsOf(d).length);
}
export async function attendanceToday(date) {
  const s = await getAttendanceSummary({ view: 'daily', date });
  const total = num(s.total_employees);
  const present = num(s.present);
  return {
    total,
    present,
    absent: num(s.absent),
    onLeave: num(s.leave),
    percent: num(s.attendance_percentage) ?? (total && present != null ? Math.round((present / total) * 100) : null),
  };
}
export async function payrollSummary() {
  const runs = await listPayrollRuns({ limit: 20 });
  const latest = runs[0];
  return {
    latest: latest
      ? {
          id: String(latest.id),
          period: latest.period,
          status: latest.status,
          net: num(latest.net ?? latest.totals?.net),
        }
      : null,
    awaiting: runs.filter((r) => r.status === 'Pending Approval').length,
  };
}
export const grievanceStats = getGrievanceStats;
