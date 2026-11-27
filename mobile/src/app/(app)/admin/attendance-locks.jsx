import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  getAttendanceReport,
  getLocks,
  getWorkHours,
  lockMonth,
  lockOf,
  periodLabel,
  periodOf,
  recentPeriods,
  unlockMonth,
} from '@/api/admin/attendance';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, ItemCard, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const sum = (rows, pick) => {
  const vals = rows.map(pick).filter(isNum).map(Number);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : '—';
};

function Stat({ label, value }) {
  const c = useColors();
  return (
    <View style={{ flexBasis: '22%', flexGrow: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{value ?? '—'}</Text>
      <Muted style={{ fontSize: 11, textAlign: 'center' }}>{label}</Muted>
    </View>
  );
}

/**
 * Payroll attendance lock (web: AttendancePayrollLockTab → PayrollAttendanceLockPanel).
 * Reads GET /attendance/report + /attendance/work-hours for the month and GET /attendance/locks;
 * locks with POST /attendance/locks { period } and unlocks with DELETE /attendance/locks/{period}.
 */
export default function AttendanceLocksScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { can, role } = useAccess();
  const canLock = can('attendance.lock') || role.includes('HR');
  const [period, setPeriod] = useState(periodOf());
  const [search, setSearch] = useState('');

  const report = useQuery({
    queryKey: ['admin', 'attendance', 'lock-report', period],
    queryFn: () => getAttendanceReport({ month: period }),
  });
  const hours = useQuery({
    queryKey: ['admin', 'attendance', 'lock-hours', period],
    queryFn: () => getWorkHours({ month: period }),
  });
  const locks = useQuery({ queryKey: ['admin', 'attendance', 'locks'], queryFn: getLocks });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'attendance'] });
  const lock = useMutation({
    mutationFn: () => lockMonth(period),
    onSuccess: () => {
      Alert.alert('Attendance', `${periodLabel(period)} attendance locked.`);
      refresh();
    },
    onError: (e) => Alert.alert('Attendance', errorMessage(e, 'Could not lock attendance.')),
  });
  const unlock = useMutation({
    mutationFn: (p) => unlockMonth(p),
    onSuccess: (_d, p) => {
      Alert.alert('Attendance', `${periodLabel(p)} attendance unlocked.`);
      refresh();
    },
    onError: (e) => {
      Alert.alert('Attendance', errorMessage(e, 'Could not unlock attendance.'));
      if ([404, 409].includes(e?.response?.status)) refresh();
    },
  });

  // Employee rows: report summary joined with the work-hours totals (web: allRows).
  const rows = useMemo(() => {
    const byId = new Map((hours.data?.employees ?? []).map((h) => [String(h.employee_id), h]));
    return (report.data?.employees ?? []).map((r) => ({ report: r, hours: byId.get(String(r.employee_id))?.totals }));
  }, [report.data, hours.data]);
  const readyToLock =
    rows.length > 0 &&
    rows.every(
      ({ report: r, hours: h }) =>
        [r.present, r.absent, r.leave, r.working_days].every(isNum) &&
        h &&
        [h.half_days, h.late_days, h.overtime_hours, h.short_hours].every(isNum),
    );
  const totals = [
    ['Present', sum(rows, (x) => x.report.present)],
    ['Absent', sum(rows, (x) => x.report.absent)],
    ['Leave', sum(rows, (x) => x.report.leave)],
    ['Half days', sum(rows, (x) => x.hours?.half_days)],
    ['Late marks', sum(rows, (x) => x.hours?.late_days)],
    ['Overtime h', sum(rows, (x) => x.hours?.overtime_hours)],
    ['Short h', sum(rows, (x) => x.hours?.short_hours)],
    ['Working days', sum(rows, (x) => x.report.working_days)],
  ];

  const current = lockOf(locks.data, period);
  const loading = report.isLoading || hours.isLoading || locks.isLoading;
  const statusUnavailable = Boolean(locks.error);
  const locked = loading || statusUnavailable || Boolean(current);
  const loadError = report.error || hours.error;
  const lockedPeriods = Object.entries(locks.data?.locks ?? {}).sort(([a], [b]) => b.localeCompare(a));

  const confirmLock = () =>
    Alert.alert(
      `Lock ${periodLabel(period)} attendance?`,
      'This records the monthly attendance for payroll and prevents further punch changes for this period. Review the employee summaries before continuing.',
      [
        { text: 'Review again', style: 'cancel' },
        { text: 'Confirm lock', onPress: () => lock.mutate() },
      ],
    );
  const confirmUnlock = (p) =>
    Alert.alert(
      `Unlock ${periodLabel(p)} attendance?`,
      'Punches and leave for this month become editable again. The server refuses this while a payroll run for the month is pending approval, approved, processed or paid.',
      [
        { text: 'Keep locked', style: 'cancel' },
        { text: 'Unlock', style: 'destructive', onPress: () => unlock.mutate(p) },
      ],
    );

  const term = search.trim().toLowerCase();
  const shown = rows.filter(
    ({ report: r }) =>
      !term || [r.name, r.employee_code, r.department].some((v) => String(v ?? '').toLowerCase().includes(term)),
  );

  return (
    <Page
      onRefresh={() => {
        report.refetch();
        hours.refetch();
        locks.refetch();
      }}
      refreshing={report.isRefetching || hours.isRefetching || locks.isRefetching}>
      <Header title="Payroll attendance lock" />
      <CompanyScopeNotice />
      <Select label="Attendance month" value={period} options={recentPeriods()} onChange={setPeriod} />

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Muted style={{ flex: 1 }}>Payroll attendance lock · {periodLabel(period)}</Muted>
          <Badge
            label={
              loading
                ? 'Checking…'
                : statusUnavailable
                  ? 'Status unavailable'
                  : current
                    ? 'Locked'
                    : 'Open for review'
            }
            tone={current ? 'primary' : statusUnavailable ? 'danger' : 'warning'}
          />
        </View>
        {!loading && current ? (
          <Muted>
            Attendance is read-only for payroll · Locked by {current.by ?? current.locked_by ?? '—'} on{' '}
            {fmtDate(current.on ?? current.locked_at)}
            {current.employees_covered != null ? ` · ${current.employees_covered} employees` : ''}
          </Muted>
        ) : null}
        {statusUnavailable ? (
          <ErrorText>{errorMessage(locks.error, 'Could not load the lock status.')}</ErrorText>
        ) : null}
        {loadError ? <ErrorText>{errorMessage(loadError, 'Could not load attendance from the server.')}</ErrorText> : null}
        {!loading && !locked && rows.length > 0 && !readyToLock ? (
          <Muted>
            Attendance cannot be locked until the monthly summary (present, absent, leave, working days, half days,
            late marks, overtime and short hours) is available for every employee.
          </Muted>
        ) : null}
        {canLock && !locked ? (
          <Button
            title="Lock attendance"
            onPress={confirmLock}
            loading={lock.isPending}
            disabled={!readyToLock || Boolean(loadError)}
          />
        ) : null}
        {canLock && !loading && !statusUnavailable && current ? (
          <Button
            title="Unlock"
            variant="outline"
            onPress={() => confirmUnlock(period)}
            loading={unlock.isPending}
          />
        ) : null}
      </Card>

      <Card>
        {loading ? (
          <Loading />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
            <Stat label="Employees" value={rows.length} />
            {totals.map(([label, value]) => (
              <Stat key={label} label={label} value={value} />
            ))}
          </View>
        )}
      </Card>

      {lockedPeriods.length ? (
        <Card style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>Locked months</Text>
          {lockedPeriods.map(([p, info]) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Muted style={{ flex: 1 }}>
                {periodLabel(p)} · {info?.by ?? '—'} · {fmtDate(info?.on)}
              </Muted>
              {canLock ? (
                <Text
                  onPress={() => confirmUnlock(p)}
                  style={{ color: c.danger, fontWeight: '600', paddingVertical: 4 }}>
                  Unlock
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Field
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Employee or department"
        autoCapitalize="none"
      />
      {!loading && !loadError && shown.length === 0 ? <Muted>No employees in this scope.</Muted> : null}
      {shown.map(({ report: r, hours: h }) => (
        <ItemCard
          key={String(r.employee_id)}
          title={r.name || r.employee_code || 'Employee'}
          badge={r.attendance_pct != null ? <Badge label={`${r.attendance_pct}%`} tone="muted" /> : null}
          lines={[
            [r.employee_code, r.department].filter(Boolean).join(' · ') || null,
            `P ${r.present ?? '—'} · A ${r.absent ?? '—'} · L ${r.leave ?? '—'} · Working ${r.working_days ?? '—'}`,
            `Half ${h?.half_days ?? '—'} · Late ${h?.late_days ?? '—'} · OT ${h?.overtime_hours ?? '—'}h · Short ${h?.short_hours ?? '—'}h`,
          ]}
        />
      ))}
    </Page>
  );
}
