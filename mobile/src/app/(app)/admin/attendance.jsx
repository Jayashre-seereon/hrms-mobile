import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  ATTENDANCE_STATUS,
  getAttendanceSummary,
  getDailyAttendance,
  getMonthlyAttendance,
  getWeeklyAttendance,
  periodOf,
  recentPeriods,
} from '@/api/admin/attendance';
import { personName } from '@/api/admin/common';
import { loadNameOptions } from '@/api/admin/masters';
import { listBranches } from '@/api/admin/masters-extra';
import { errorMessage } from '@/lib/api';
import { useAccess, useScope } from '@/lib/access';
import { Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { Badge, DateField, Header, ItemCard, MenuRow, Page, Segments, Select, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';

const hours = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(1)}h`);
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);
const toneOf = (s) => (s === 'P' ? 'success' : s === 'A' ? 'danger' : s === 'L' ? 'primary' : s ? 'muted' : undefined);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
/** Monday → Sunday of the current week (web: thisWeek()). */
function thisWeek() {
  const d = new Date();
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  return [toISODate(mon), toISODate(sun)];
}
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...['P', 'A', 'WO', 'L', 'H'].map((k) => ({ value: k, label: ATTENDANCE_STATUS[k] })),
];
const VIEWS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function Stat({ label, value }) {
  const c = useColors();
  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{value ?? '—'}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

/** One small status square per day (weekly / monthly rows). */
function StatusStrip({ days }) {
  const c = useColors();
  const color = { P: c.success, A: c.danger, L: c.primary, H: c.warning };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
      {(days ?? []).map((a) => (
        <View
          key={a.date}
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 2,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: color[a.status] ?? c.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: color[a.status] ?? c.muted }}>
            {a.status || String(a.date).slice(-2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Admin attendance for every employee in scope (web: EmployeeAttendanceTab — daily / weekly / monthly). */
export default function AdminAttendanceScreen() {
  const router = useRouter();
  const { can, role } = useAccess();
  const { companyId } = useScope();
  const [view, setView] = useState('daily');
  const [date, setDate] = useState(toISODate(new Date()));
  const [[start, end], setRange] = useState(thisWeek);
  const [period, setPeriod] = useState(periodOf());
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [designation, setDesignation] = useState('');
  const [search, setSearch] = useState('');

  const branches = useQuery({
    queryKey: ['admin', 'attendance', 'branches', companyId ?? ''],
    queryFn: () => listBranches(companyId || null),
  });
  const designations = useQuery({
    queryKey: ['admin', 'attendance', 'designations', companyId ?? ''],
    queryFn: () => loadNameOptions('/super-admin/designations'),
  });

  const rangeDays = daysBetween(start, end);
  const rangeError =
    view === 'weekly' && (!(rangeDays >= 1) || rangeDays > 31) ? 'Pick a range of 1 to 31 days.' : '';
  const [year, month] = period.split('-').map(Number);

  /** Period part of the query for the active view (same params as the web). */
  const periodParams = useMemo(() => {
    if (view === 'daily') return { date };
    if (view === 'weekly') return { start_date: start, end_date: end };
    return { month, year };
  }, [view, date, start, end, month, year]);
  const filters = { designation, status, branch_id: branchId };

  const list = useQuery({
    queryKey: ['admin', 'attendance', view, periodParams, filters],
    enabled: !rangeError,
    queryFn: () => {
      const call =
        view === 'daily' ? getDailyAttendance : view === 'weekly' ? getWeeklyAttendance : getMonthlyAttendance;
      return call({ ...periodParams, ...filters });
    },
  });
  const summary = useQuery({
    queryKey: ['admin', 'attendance', 'summary', view, periodParams, branchId, designation],
    enabled: !rangeError,
    queryFn: () => getAttendanceSummary({ view, ...periodParams, branch_id: branchId, designation }),
  });

  const s = summary.data ?? {};
  const term = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (e) =>
      !term ||
      [personName(e), e.employee_code, e.work_email].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(term),
      ),
  );
  // Weekly / monthly: count calendar dates (not employee-days) with WO / L / H — same as the web.
  const dateTotals = useMemo(() => {
    const sets = { WO: new Set(), L: new Set(), H: new Set() };
    (list.data ?? []).forEach((e) =>
      (e.attendance ?? []).forEach((a) => sets[a.status]?.add(a.date)),
    );
    return { WO: sets.WO.size, L: sets.L.size, H: sets.H.size };
  }, [list.data]);

  /** Detail range: daily → the date's month (web), otherwise the current period. */
  const openEmployee = (e) => {
    const id = e.employee_id ?? e.id;
    if (!id) return;
    const q =
      view === 'daily'
        ? { month: Number(date.slice(5, 7)), year: Number(date.slice(0, 4)) }
        : view === 'weekly'
          ? { start_date: start, end_date: end }
          : { month, year };
    router.push({ pathname: '/admin/attendance-employee/[id]', params: { id: String(id), ...q } });
  };

  const canLock = can('attendance.lock') || role.includes('HR');
  const branchOptions = [
    { value: '', label: 'All branches' },
    ...(branches.data ?? []).map((b) => ({ value: b.id, label: b.name || b.code || 'Branch' })),
  ];
  const designationOptions = [{ value: '', label: 'All designations' }, ...(designations.data ?? [])];

  return (
    <Page
      onRefresh={() => {
        list.refetch();
        summary.refetch();
      }}
      refreshing={list.isRefetching || summary.isRefetching}>
      <Header title="Employee attendance" />
      <CompanyScopeNotice />

      <Card style={{ paddingVertical: 4 }}>
        <MenuRow
          icon="bar-chart-outline"
          label="Attendance report"
          hint="Monthly report, work hours & overtime"
          onPress={() => router.push('/admin/attendance-reports')}
        />
        {canLock ? (
          <MenuRow
            icon="lock-closed-outline"
            label="Payroll attendance lock"
            hint="Review and lock a month for payroll"
            onPress={() => router.push('/admin/attendance-locks')}
          />
        ) : null}
      </Card>

      <Segments value={view} options={VIEWS} onChange={setView} />

      {view === 'daily' ? <DateField label="Date" value={date} onChange={setDate} /> : null}
      {view === 'weekly' ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <DateField label="From" value={start} onChange={(v) => setRange([v, end])} error={rangeError || undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="To" value={end} onChange={(v) => setRange([start, v])} />
          </View>
        </View>
      ) : null}
      {view === 'monthly' ? (
        <Select label="Month" value={period} options={recentPeriods()} onChange={setPeriod} />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        </View>
        <View style={{ flex: 1 }}>
          <Select label="Branch" value={branchId} options={branchOptions} onChange={setBranchId} />
        </View>
      </View>
      <Select label="Designation" value={designation} options={designationOptions} onChange={setDesignation} />

      <Card>
        {rangeError ? (
          <ErrorText>{rangeError}</ErrorText>
        ) : summary.isLoading ? (
          <Loading />
        ) : summary.error ? (
          <ErrorText>{errorMessage(summary.error, 'Could not load the summary.')}</ErrorText>
        ) : view === 'daily' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
            <Stat label="Employees" value={s.total_employees} />
            <Stat label="Present" value={s.present} />
            <Stat label="Absent" value={s.absent} />
            <Stat label="On leave" value={s.leave} />
            <Stat label="Week off" value={s.week_off} />
            <Stat label="Holiday" value={s.holiday} />
            <Stat label="Attendance" value={pct(s.attendance_percentage)} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
            <Stat label="Employees" value={s.total_employees} />
            <Stat label="Present days" value={s.present} />
            <Stat label="Absent days" value={s.absent} />
            <Stat label="Week-off days" value={dateTotals.WO} />
            <Stat label="Leave days" value={dateTotals.L} />
            <Stat label="Holiday days" value={dateTotals.H} />
            <Stat label="Attendance" value={pct(s.attendance_percentage)} />
          </View>
        )}
      </Card>

      {Array.isArray(s.branch_wise) && s.branch_wise.length > 1 ? (
        <Card style={{ gap: 4 }}>
          {s.branch_wise.map((b) => (
            <Muted key={String(b.branch_id ?? b.branch_name)}>
              {b.branch_name} · {b.present}P / {b.absent}A · {pct(b.attendance_percentage)}
            </Muted>
          ))}
        </Card>
      ) : null}

      <Field
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Name or employee ID"
        autoCapitalize="none"
      />

      {rangeError ? null : list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorText>{errorMessage(list.error, 'Could not load attendance.')}</ErrorText>
      ) : rows.length === 0 ? (
        <Muted>No employees in this scope.</Muted>
      ) : view === 'daily' ? (
        rows.map((e, i) => (
          <ItemCard
            key={String(e.employee_id ?? e.id ?? i)}
            title={personName(e) || 'Employee'}
            onPress={() => openEmployee(e)}
            badge={
              <Badge
                label={ATTENDANCE_STATUS[e.attendance_status] ?? e.attendance_status ?? 'Not marked'}
                tone={toneOf(e.attendance_status)}
              />
            }
            lines={[
              e.shift_name ? `Shift: ${e.shift_name}` : null,
              `In ${fmtTime(e.punch_in)} · Out ${fmtTime(e.punch_out)} · ${hours(e.working_hours)}`,
            ]}
          />
        ))
      ) : (
        rows.map((e, i) => (
          <ItemCard
            key={String(e.employee_id ?? e.id ?? i)}
            title={personName(e) || 'Employee'}
            onPress={() => openEmployee(e)}
            lines={[
              `P ${e.summary?.present ?? 0} · A ${e.summary?.absent ?? 0} · L ${e.summary?.leave ?? 0} · ${hours(e.summary?.total_working_hours)}`,
            ]}>
            <StatusStrip days={e.attendance} />
          </ItemCard>
        ))
      )}
    </Page>
  );
}
