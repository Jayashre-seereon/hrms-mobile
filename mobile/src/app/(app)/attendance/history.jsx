import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { getMyCalendar, getMyMonthlyHistory, getMyRegister, getMySummary } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Loading, Muted } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { Header, MenuRow, Page, Segments, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const pad2 = (n) => String(n).padStart(2, '0');
const periodOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const periodLabel = (p) => new Date(`${p}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });
/** Last 12 months, newest first (web: registerMonths()). */
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  const p = periodOf(new Date(now.getFullYear(), now.getMonth() - i, 1));
  return { value: p, label: periodLabel(p) };
});
const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];
const LABEL = { P: 'Present', A: 'Absent', L: 'Leave', MP: 'Missed punch-out', WO: 'Week off', H: 'Holiday' };
const REGISTER_LABEL = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  WEEK_OFF: 'Week off',
  HOLIDAY: 'Holiday',
  MISSED_PUNCH: 'Missed punch-out',
};
const weekday = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: 'short' });

function Kpi({ label, value, sub }) {
  const c = useColors();
  return (
    <View style={{ flexBasis: '45%', flexGrow: 1, gap: 2 }}>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{value}</Text>
      {sub ? <Muted style={{ fontSize: 12 }}>{sub}</Muted> : null}
    </View>
  );
}

/**
 * My attendance history (web: MyAttendanceView — KPIs, day/week/month calendar, monthly history).
 * GET /attendance/my-summary, /attendance/my-calendar, /attendance/register (view=month), /attendance/my-monthly-history.
 */
export default function AttendanceHistoryScreen() {
  const c = useColors();
  const router = useRouter();
  const [period, setPeriod] = useState(MONTHS[0].value);
  const [view, setView] = useState('month');
  const [week, setWeek] = useState('1');
  const [day, setDay] = useState('01');
  const [year, month] = period.split('-').map(Number);

  const summary = useQuery({
    queryKey: ['attendance', 'summary', year, month],
    queryFn: () => getMySummary(month, year),
  });
  const calendar = useQuery({
    queryKey: ['attendance', 'calendar', year, month],
    queryFn: () => getMyCalendar(month, year),
  });
  const register = useQuery({
    queryKey: ['attendance', 'register', year, month],
    queryFn: () => getMyRegister({ view: 'month', month, year }),
  });
  const history = useQuery({ queryKey: ['attendance', 'monthly-history', 6], queryFn: () => getMyMonthlyHistory(6) });

  const allDays = useMemo(
    () => Object.entries(calendar.data?.days ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [calendar.data],
  );
  // Same slicing as the web: day = one date, week N = days (N-1)*7 … +7, month = all.
  const days =
    view === 'day'
      ? allDays.filter(([iso]) => iso === `${period}-${day}`)
      : view === 'week'
        ? allDays.slice((Number(week) - 1) * 7, (Number(week) - 1) * 7 + 7)
        : allDays;
  const registerByDate = useMemo(
    () => new Map((register.data?.days ?? []).map((d) => [d.date, d])),
    [register.data],
  );
  const s = summary.data;
  const tone = {
    P: c.success,
    A: c.danger,
    L: c.warning,
    MP: c.danger,
    H: c.primary,
  };
  const refreshing = summary.isRefetching || calendar.isRefetching || history.isRefetching || register.isRefetching;

  return (
    <Page
      onRefresh={() => {
        summary.refetch();
        calendar.refetch();
        register.refetch();
        history.refetch();
      }}
      refreshing={refreshing}>
      <Header title="My attendance history" />

      <Card style={{ paddingVertical: 4 }}>
        <MenuRow
          icon="finger-print-outline"
          label="My punches"
          hint="Punch log, biometric punch, remove today's punch"
          onPress={() => router.push('/attendance/punches')}
        />
      </Card>

      <Select
        label="Month"
        value={period}
        options={MONTHS}
        onChange={(p) => {
          setPeriod(p);
          setDay('01');
        }}
      />

      <Card>
        {summary.isLoading ? (
          <Loading />
        ) : summary.error ? (
          <ErrorText>{errorMessage(summary.error, 'Could not load your summary.')}</ErrorText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 12 }}>
            <Kpi
              label="Present (period)"
              value={String(s?.present_days ?? 0)}
              sub={`${s?.absent_days ?? 0} absent · ${s?.leave_days ?? 0} leave`}
            />
            <Kpi label="Avg. work hours" value={`${s?.avg_work_hours ?? 0} h`} sub={`${s?.half_days ?? 0} half days`} />
            <Kpi label="Overtime" value={`${s?.overtime_hours ?? 0} h`} />
            <Kpi label="Short hours" value={`${s?.short_hours ?? 0} h`} sub={`${s?.late_marks ?? 0} late marks`} />
          </View>
        )}
      </Card>

      <Segments value={view} options={VIEWS} onChange={setView} />
      {view === 'week' ? (
        <Select
          label="Week"
          value={week}
          options={['1', '2', '3', '4', '5'].map((w) => ({ value: w, label: `Week ${w}` }))}
          onChange={setWeek}
        />
      ) : null}
      {view === 'day' ? (
        <Select
          label="Day"
          value={day}
          options={allDays.map(([iso]) => ({ value: iso.slice(8), label: `${iso.slice(8)} ${weekday(iso)}` }))}
          onChange={setDay}
        />
      ) : null}

      {calendar.isLoading ? (
        <Loading />
      ) : calendar.error ? (
        <ErrorText>{errorMessage(calendar.error, 'Could not load your calendar.')}</ErrorText>
      ) : days.length === 0 ? (
        <Muted>No attendance recorded for this period.</Muted>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {days.map(([iso, st]) => {
            const color = tone[st] ?? c.muted;
            const reg = registerByDate.get(iso);
            return (
              <View
                key={iso}
                style={{
                  width: view === 'month' ? '23%' : '100%',
                  flexGrow: view === 'month' ? 0 : 1,
                  borderWidth: 1,
                  borderColor: st ? color : c.border,
                  backgroundColor: c.card,
                  borderRadius: 10,
                  padding: 8,
                  alignItems: view === 'month' ? 'center' : 'flex-start',
                  gap: 2,
                }}>
                <Muted style={{ fontSize: 11 }}>
                  {iso.slice(8)} {weekday(iso)}
                </Muted>
                <Text style={{ color: st ? color : c.muted, fontWeight: '700', fontSize: view === 'month' ? 12 : 14 }}>
                  {view === 'month' ? st || '—' : LABEL[st] || st || '—'}
                </Text>
                {view !== 'month' && reg ? (
                  <Muted style={{ fontSize: 12 }}>
                    {reg.holiday_name ? `${reg.holiday_name} · ` : ''}
                    In {fmtTime(reg.in_time)} · Out {fmtTime(reg.out_time)}
                    {reg.hours != null ? ` · ${Number(reg.hours).toFixed(2)} h` : ''}
                  </Muted>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      {view === 'month' && days.length ? (
        <Muted style={{ fontSize: 12 }}>
          P Present · A Absent · L Leave · WO Week off · H Holiday · MP Missed punch-out. Switch to Day or Week for
          punch times.
        </Muted>
      ) : null}
      {register.data?.totals && view === 'month' ? (
        <Muted style={{ fontSize: 12 }}>
          {Object.entries(register.data.totals)
            .filter(([k]) => REGISTER_LABEL[k])
            .map(([k, v]) => `${REGISTER_LABEL[k]} ${v}`)
            .join(' · ')}
        </Muted>
      ) : null}

      <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Monthly attendance history</Text>
      {history.isLoading ? (
        <Loading />
      ) : history.error ? (
        <ErrorText>{errorMessage(history.error, 'Could not load your history.')}</ErrorText>
      ) : !history.data?.length ? (
        <Muted>No history yet.</Muted>
      ) : (
        history.data.map((m) => {
          const present = Number(m.present ?? 0);
          const working = present + Number(m.absent ?? 0) + Number(m.leave ?? 0);
          const pct = working ? Math.round((present / working) * 1000) / 10 : 0;
          return (
            <Card key={m.month} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{periodLabel(m.month)}</Text>
                <Muted>{pct} % attendance</Muted>
              </View>
              <Muted>
                Present {m.present ?? 0} · Absent {m.absent ?? 0} · Leave {m.leave ?? 0} · Overtime{' '}
                {m.overtime ?? m.overtime_hours ?? 0} h
              </Muted>
            </Card>
          );
        })
      )}
    </Page>
  );
}
