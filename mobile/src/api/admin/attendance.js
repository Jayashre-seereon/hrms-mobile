import { api } from '@/lib/api';
import { clean, unwrap } from './common';
/** Admin "Employee Attendance" — same endpoints as the web employeeAttendanceApi (src/api/attendanceApi.js). */
const BASE = '/attendance/employee-attendance';
export const ATTENDANCE_STATUS = {
  P: 'Present',
  A: 'Absent',
  WO: 'Week off',
  L: 'Leave',
  H: 'Holiday',
  HD: 'Half day',
};
/** GET /attendance/employee-attendance/daily?date=YYYY-MM-DD → rows (`employees`). */
export async function getDailyAttendance(params) {
  const { data } = await api.get(`${BASE}/daily`, { params: clean(params) });
  const d = unwrap(data);
  return Array.isArray(d) ? d : (d?.employees ?? d?.items ?? []);
}
/** GET /attendance/employee-attendance/summary?view=daily&date=… */
export async function getAttendanceSummary(params) {
  const { data } = await api.get(`${BASE}/summary`, { params: clean({ view: 'daily', ...params }) });
  const d = unwrap(data);
  return d?.summary ?? d ?? {};
}
/** Rows of a list response (`employees`, `items`, or a plain array). */
const employeesOf = (body) => {
  const d = unwrap(body);
  return Array.isArray(d) ? d : (d?.employees ?? d?.items ?? []);
};
/** GET /attendance/employee-attendance/weekly?start_date&end_date (1–31 days) + filters. */
export async function getWeeklyAttendance(params) {
  const { data } = await api.get(`${BASE}/weekly`, { params: clean(params) });
  return employeesOf(data);
}
/** GET /attendance/employee-attendance/monthly?month&year + filters. */
export async function getMonthlyAttendance(params) {
  const { data } = await api.get(`${BASE}/monthly`, { params: clean(params) });
  return employeesOf(data);
}
/** GET /attendance/employee-attendance/employees/{id} — one employee's days (month/year or start_date/end_date). */
export async function getEmployeeAttendance(employeeId, params) {
  const { data } = await api.get(`${BASE}/employees/${encodeURIComponent(employeeId)}`, { params: clean(params) });
  return unwrap(data) ?? {};
}

// ── Reports (web: AttendanceReportApiTabs) ──
/** GET /attendance/report?month=YYYY-MM&dept&office&shift&empId&band&sort → { month, total_employees, employees }. */
export async function getAttendanceReport(params) {
  const { data } = await api.get('/attendance/report', { params: clean(params) });
  return unwrap(data) ?? {};
}
/** GET /attendance/work-hours?month=YYYY-MM&dept&office&shift&empId → employees with `days` + `totals`. */
export async function getWorkHours(params) {
  const { data } = await api.get('/attendance/work-hours', { params: clean(params) });
  return unwrap(data) ?? {};
}

// ── Payroll attendance lock (web: PayrollAttendanceLockPanel) ──
/** GET /attendance/locks → { locked_months: [...], locks: { 'YYYY-MM': { by, on, employees_covered } } }. */
export async function getLocks() {
  const { data } = await api.get('/attendance/locks');
  return unwrap(data) ?? {};
}
/** POST /attendance/locks { period: 'YYYY-MM' }. */
export async function lockMonth(period) {
  return (await api.post('/attendance/locks', { period })).data;
}
/** DELETE /attendance/locks/{period} — 409 while a payroll run for the month is in progress, 404 if not locked. */
export async function unlockMonth(period) {
  return (await api.delete(`/attendance/locks/${encodeURIComponent(period)}`)).data;
}
/** Lock record for one month from the locks payload (map or array form). */
export function lockOf(payload, period) {
  const src = payload?.locks ?? payload?.items ?? payload ?? {};
  if (Array.isArray(src)) return src.find((l) => l.period === period) ?? null;
  return src?.[period] ?? null;
}

// ── Biometric devices ──
/** GET /attendance/devices → [{ id, name, location, status, last_seen_at }]. */
export async function getDevices() {
  const { data } = await api.get('/attendance/devices');
  const d = unwrap(data);
  return Array.isArray(d) ? d : (d?.items ?? []);
}

// ── Month helpers shared by the attendance screens ──
const pad2 = (n) => String(n).padStart(2, '0');
/** "YYYY-MM" of a date (local time). */
export const periodOf = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
/** "May 2026" from "YYYY-MM". */
export const periodLabel = (p) =>
  new Date(`${p}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });
/** Select options for the last `count` months, newest first. */
export function recentPeriods(count = 24) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const p = periodOf(new Date(now.getFullYear(), now.getMonth() - i, 1));
    return { value: p, label: periodLabel(p) };
  });
}
