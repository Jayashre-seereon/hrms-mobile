import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ATTENDANCE_STATUS, getAttendanceSummary, getDailyAttendance } from '@/api/admin/attendance';
import { personName } from '@/api/admin/common';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { Badge, DateField, Header, ItemCard, Page, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';

const hours = (v: unknown) => (v == null || v === '' ? '—' : `${Number(v).toFixed(1)}h`);
const toneOf = (s?: string) =>
  s === 'P' ? 'success' : s === 'A' ? 'danger' : s === 'L' ? 'primary' : s ? 'muted' : undefined;

function Stat({ label, value }: { label: string; value?: number | string | null }) {
  const c = useColors();
  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{value ?? '—'}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

/** Admin daily attendance for every employee in scope (web: EmployeeAttendanceTab, daily view). */
export default function AdminAttendanceScreen() {
    const [date, setDate] = useState(toISODate(new Date()));
  const [search, setSearch] = useState('');

  const list = useQuery({ queryKey: ['admin', 'attendance', 'daily', date], queryFn: () => getDailyAttendance({ date }) });
  const summary = useQuery({ queryKey: ['admin', 'attendance', 'summary', date], queryFn: () => getAttendanceSummary({ view: 'daily', date }) });

  const s = summary.data ?? {};
  const term = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (e) => !term || [personName(e), e.employee_code, e.work_email].some((v) => String(v ?? '').toLowerCase().includes(term)),
  );
  const pct = s.attendance_percentage != null ? `${Math.round(Number(s.attendance_percentage))}%` : null;

  return (
    <Page
      onRefresh={() => {
        list.refetch();
        summary.refetch();
      }}
      refreshing={list.isRefetching || summary.isRefetching}>
      <Header title="Employee attendance" />
      <CompanyScopeNotice />
      <DateField label="Date" value={date} onChange={setDate} />

      <Card>
        {summary.isLoading ? (
          <Loading />
        ) : summary.error ? (
          <ErrorText>{errorMessage(summary.error, 'Could not load the summary.')}</ErrorText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
            <Stat label="Employees" value={s.total_employees} />
            <Stat label="Present" value={s.present} />
            <Stat label="Absent" value={s.absent} />
            <Stat label="On leave" value={s.leave} />
            <Stat label="Week off" value={s.week_off} />
            <Stat label="Attendance" value={pct} />
          </View>
        )}
      </Card>

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name or employee ID" autoCapitalize="none" />

      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorText>{errorMessage(list.error, 'Could not load attendance.')}</ErrorText>
      ) : rows.length === 0 ? (
        <Muted>No attendance records for this day.</Muted>
      ) : (
        rows.map((e, i) => (
          <ItemCard
            key={String(e.employee_id ?? e.id ?? i)}
            title={personName(e) || 'Employee'}
            badge={<Badge label={ATTENDANCE_STATUS[e.attendance_status] ?? e.attendance_status ?? 'Not marked'} tone={toneOf(e.attendance_status)} />}
            lines={[
              e.shift_name ? `Shift: ${e.shift_name}` : null,
              `In ${fmtTime(e.punch_in)} · Out ${fmtTime(e.punch_out)} · ${hours(e.working_hours)}`,
            ]}
          />
        ))
      )}
    </Page>
  );
}
