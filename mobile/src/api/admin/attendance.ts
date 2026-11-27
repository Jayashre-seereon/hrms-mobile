import { api } from '@/lib/api';

import { clean, unwrap } from './common';

/** Admin "Employee Attendance" — same endpoints as the web employeeAttendanceApi (src/api/attendanceApi.js). */
const BASE = '/attendance/employee-attendance';

export const ATTENDANCE_STATUS: Record<string, string> = {
  P: 'Present',
  A: 'Absent',
  WO: 'Week off',
  L: 'Leave',
  H: 'Holiday',
  HD: 'Half day',
};

/** GET /attendance/employee-attendance/daily?date=YYYY-MM-DD → rows (`employees`). */
export async function getDailyAttendance(params: { date: string; search?: string }) {
  const { data } = await api.get(`${BASE}/daily`, { params: clean(params) });
  const d = unwrap(data);
  return (Array.isArray(d) ? d : (d?.employees ?? d?.items ?? [])) as any[];
}

/** GET /attendance/employee-attendance/summary?view=daily&date=… */
export async function getAttendanceSummary(params: { view?: string; date?: string }) {
  const { data } = await api.get(`${BASE}/summary`, { params: clean({ view: 'daily', ...params }) });
  const d = unwrap(data);
  return (d?.summary ?? d ?? {}) as Record<string, any>;
}
