import { api } from '@/lib/api';
/**
 * Holidays — same endpoint and mapping as the web app
 * (src/api/employee_holiday_calendar.js + features/organization/data/employeeHolidayAdapter.js).
 * GET /attendance/holiday-calendars returns calendars; each has holidays[] { holiday_date, holiday_name }.
 */
const PAGE_SIZE = 100;
const TYPE_LABEL = {
  NATIONAL: 'Public',
  REGIONAL_STATE: 'State',
  OPTIONAL_RESTRICTED: 'Optional',
};
const TYPE_ALIASES = {
  NATIONAL: 'NATIONAL',
  'REGIONAL / STATE': 'REGIONAL_STATE',
  'OPTIONAL / RESTRICTED': 'OPTIONAL_RESTRICTED',
};
const typeCode = (t) => {
  const v = String(t ?? '')
    .trim()
    .toUpperCase();
  return TYPE_ALIASES[v] ?? v;
};
function isPaid(cal) {
  const c = String(cal.leave_category ?? '').toUpperCase();
  if (c === 'PAID') return true;
  if (c === 'UNPAID') return false;
  return typeCode(cal.type) !== 'OPTIONAL_RESTRICTED';
}
export function calendarsToHolidays(calendars) {
  const seen = new Set();
  const list = [];
  calendars.forEach((cal) => {
    const code = typeCode(cal.type);
    const title = String(cal.holiday_title ?? '').trim();
    const year = cal.year ?? '';
    const description = title && !title.includes(String(year)) ? `${title} ${year}` : title;
    (Array.isArray(cal.holidays) ? cal.holidays : []).forEach((h) => {
      const date = h.holiday_date ?? '';
      const name = String(h.holiday_name ?? '').trim();
      if (!date || !name) return;
      const key = `${date}|${name.toLowerCase()}|${code}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        id: String(h.id ?? `${cal.id}-${date}`),
        name,
        type: TYPE_LABEL[code] ?? cal.type ?? '',
        paid: isPaid(cal),
        date,
        description,
      });
    });
  });
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
/** Loads every page of holiday calendars for the logged-in employee. */
export async function loadEmployeeHolidays(params = {}) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data } = await api.get('/attendance/holiday-calendars', {
      params: { ...params, page, page_size: PAGE_SIZE },
    });
    const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    all.push(...items);
    const pages = Number(data?.pages ?? 1);
    if (Array.isArray(data) || page >= pages || items.length < PAGE_SIZE) break;
  }
  return calendarsToHolidays(all);
}
