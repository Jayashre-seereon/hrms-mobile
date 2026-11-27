import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getAttendanceReport, getWorkHours, periodOf, recentPeriods } from '@/api/admin/attendance';
import { listBranches } from '@/api/admin/masters-extra';
import { errorMessage } from '@/lib/api';
import { useScope } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Badge, Header, ItemCard, Page, Segments, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const num = (v) => (v === null || v === undefined ? '—' : v);
const hhmm = (t) => (t ? String(t).slice(0, 5) : '—');
const pctTone = (v) => (v == null ? 'muted' : v >= 95 ? 'success' : v >= 80 ? 'warning' : 'danger');
const BANDS = [
  { value: '', label: 'All attendance' },
  { value: 'high', label: 'High (95%+)' },
  { value: 'medium', label: 'Medium (80-95%)' },
  { value: 'low', label: 'Low (<80%)' },
];
const SORTS = [
  { value: '', label: 'Default' },
  { value: 'name', label: 'Name' },
  { value: '-attendance_pct', label: 'Attendance % (high first)' },
  { value: 'attendance_pct', label: 'Attendance % (low first)' },
  { value: '-absent', label: 'Most absent' },
  { value: '-late_marks', label: 'Most late marks' },
  { value: '-overtime_hours', label: 'Most overtime' },
];
const TABS = [
  { value: 'report', label: 'Attendance report' },
  { value: 'hours', label: 'Work hours & OT' },
];
const EMPTY = { month: periodOf(), office: '', dept: '', shift: '', empId: '', band: '', sort: '' };

/** Value that settles `ms` after the last change (web: 250 ms debounced report calls). */
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Shown instead of the list on 403 (web: Blocked). */
function blockedText(error) {
  const status = error?.response?.status;
  const msg = errorMessage(error, 'Could not load the report.');
  if (status === 403 && /module not enabled/i.test(msg)) return 'Attendance is not enabled for this company.';
  if (status === 403) return 'No access. You need the attendance.view permission.';
  return msg;
}

/**
 * Attendance Report + Work Hours & Overtime (web: AttendanceReportApiTabs).
 * GET /attendance/report?month&dept&office&shift&empId&band&sort and GET /attendance/work-hours?month&dept&office&shift&empId.
 */
export default function AttendanceReportsScreen() {
  const c = useColors();
  const { companyId } = useScope();
  const [tab, setTab] = useState('report');
  const [f, setF] = useState(EMPTY);
  const [open, setOpen] = useState(null);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const branches = useQuery({
    queryKey: ['admin', 'attendance', 'branches', companyId ?? ''],
    queryFn: () => listBranches(companyId || null),
  });
  const d = useDebounced(f);
  const base = { month: d.month, dept: d.dept.trim(), office: d.office, shift: d.shift.trim(), empId: d.empId.trim() };
  const report = useQuery({
    queryKey: ['admin', 'attendance', 'report', base, d.band, d.sort],
    queryFn: () => getAttendanceReport({ ...base, band: d.band, sort: d.sort }),
    enabled: tab === 'report',
  });
  const hours = useQuery({
    queryKey: ['admin', 'attendance', 'work-hours', base],
    queryFn: () => getWorkHours(base),
    enabled: tab === 'hours',
  });
  const q = tab === 'report' ? report : hours;
  const rows = q.data?.employees ?? [];
  const officeOptions = [
    { value: '', label: 'All offices' },
    ...(branches.data ?? []).filter((b) => b.name).map((b) => ({ value: b.name, label: b.name })),
  ];

  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Attendance reports" />
      <CompanyScopeNotice />
      <Segments value={tab} options={TABS} onChange={setTab} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Select label="Month" value={f.month} options={recentPeriods()} onChange={(month) => set({ month })} />
        </View>
        <View style={{ flex: 1 }}>
          <Select label="Office" value={f.office} options={officeOptions} onChange={(office) => set({ office })} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Department" value={f.dept} onChangeText={(dept) => set({ dept })} placeholder="Department" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Shift" value={f.shift} onChangeText={(shift) => set({ shift })} placeholder="Shift" />
        </View>
      </View>
      <Field
        label="Employee"
        value={f.empId}
        onChangeText={(empId) => set({ empId })}
        placeholder="Employee id / code"
        autoCapitalize="none"
      />
      {tab === 'report' ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Select label="Attendance" value={f.band} options={BANDS} onChange={(band) => set({ band })} />
          </View>
          <View style={{ flex: 1 }}>
            <Select label="Sort" value={f.sort} options={SORTS} onChange={(sort) => set({ sort })} />
          </View>
        </View>
      ) : null}

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <Card>
          <ErrorText>{blockedText(q.error)}</ErrorText>
        </Card>
      ) : (
        <>
          <Muted>
            {q.data?.total_employees ?? rows.length} employees · {q.data?.month ?? f.month}
          </Muted>
          {rows.length === 0 ? <Muted>No employees in this scope.</Muted> : null}
          {tab === 'report'
            ? rows.map((r) => (
                <ItemCard
                  key={String(r.employee_id)}
                  title={r.name || r.employee_code || 'Employee'}
                  badge={
                    <Badge
                      label={r.attendance_pct == null ? '—' : `${r.attendance_pct} %`}
                      tone={pctTone(r.attendance_pct)}
                    />
                  }
                  lines={[
                    [r.employee_code, r.department, r.office, r.shift].filter(Boolean).join(' · ') || null,
                    `Working ${num(r.working_days)} · Present ${num(r.present)} · Absent ${num(r.absent)} · Leave ${num(r.leave)}`,
                    `WO ${num(r.weekly_offs)} · Holidays ${num(r.holidays)} · Half ${num(r.half_days)} · Late ${num(r.late_marks)}`,
                    `OT ${num(r.overtime_hours)} h · Short ${num(r.short_hours)} h`,
                  ]}
                />
              ))
            : rows.map((r) => {
                const t = r.totals ?? {};
                const expanded = open === r.employee_id;
                return (
                  <ItemCard
                    key={String(r.employee_id)}
                    title={r.name || r.employee_code || 'Employee'}
                    onPress={() => setOpen(expanded ? null : r.employee_id)}
                    lines={[
                      [r.employee_code, r.shift].filter(Boolean).join(' · ') || null,
                      `Days worked ${num(t.days_worked)} · Worked ${num(t.worked_hours)} h`,
                      `OT ${num(t.overtime_hours)} h · Short ${num(t.short_hours)} h · Late ${num(t.late_days)} · Half ${num(t.half_days)}`,
                      expanded ? null : 'Tap for day-wise hours',
                    ]}>
                    {expanded ? (
                      <View style={{ marginTop: 6, gap: 6 }}>
                        {(r.days ?? []).length === 0 ? <Muted>No punches this month.</Muted> : null}
                        {(r.days ?? []).map((d) => (
                          <View
                            key={d.date}
                            style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6, gap: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{d.date}</Text>
                              {d.late ? <Badge label="Late" tone="warning" /> : null}
                              {d.half_day ? <Badge label="Half day" tone="muted" /> : null}
                            </View>
                            <Muted style={{ fontSize: 12 }}>
                              In {hhmm(d.in)} · Out {hhmm(d.out)} · Worked {num(d.worked_hours)} h · OT{' '}
                              {num(d.overtime_hours)} h · Short {num(d.short_hours)} h
                            </Muted>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </ItemCard>
                );
              })}
        </>
      )}
    </Page>
  );
}
