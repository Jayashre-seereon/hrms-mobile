import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ATTENDANCE_STATUS, getEmployeeAttendance } from '@/api/admin/attendance';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Loading, Muted } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const hours = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(2)} h`);
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(1)} %`);
const toneOf = (s) => (s === 'P' ? 'success' : s === 'A' ? 'danger' : s === 'L' ? 'primary' : 'muted');

/**
 * One employee's attendance (web: EmployeeAttendanceTab → EmployeeDetail dialog).
 * GET /attendance/employee-attendance/employees/{id}?month&year | start_date&end_date
 */
export default function AdminEmployeeAttendanceScreen() {
  const c = useColors();
  const { id, month, year, start_date, end_date } = useLocalSearchParams();
  const params =
    month && year ? { month: Number(month), year: Number(year) } : { start_date, end_date };
  const q = useQuery({
    queryKey: ['admin', 'attendance', 'employee', id, params],
    queryFn: () => getEmployeeAttendance(id, params),
    enabled: Boolean(id),
  });
  const d = q.data;
  const s = d?.summary ?? {};
  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title={d?.employee_display ?? d?.employee_name ?? 'Employee attendance'} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorText>{errorMessage(q.error, 'Could not load attendance.')}</ErrorText>
      ) : (
        <>
          <Card style={{ gap: 8 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
              {d?.employee_display ?? d?.employee_name ?? 'Employee'}
            </Text>
            <Muted>
              {[d?.department, d?.branch_name, d?.date_of_joining && `Joined ${d.date_of_joining}`]
                .filter(Boolean)
                .join(' · ')}
            </Muted>
            <Muted>
              {d?.start_date} → {d?.end_date}
            </Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['present', 'absent', 'week_off', 'leave', 'holiday'].map((k) => (
                <Badge key={k} label={`${k.replace('_', ' ')} · ${s[k] ?? 0}`} tone="muted" />
              ))}
              <Badge label={`Attendance · ${pct(d?.attendance_percentage)}`} tone="primary" />
              {s.total_working_hours !== undefined ? (
                <Badge label={`Hours · ${hours(s.total_working_hours)}`} tone="primary" />
              ) : null}
            </View>
          </Card>

          {(d?.days ?? []).length === 0 ? (
            <Muted>No days in this period.</Muted>
          ) : (
            <Card style={{ gap: 0, paddingVertical: 4 }}>
              {(d?.days ?? []).map((day, i) => (
                <View
                  key={day.date}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: c.border,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '600' }}>
                      {day.date} <Text style={{ color: c.muted, fontWeight: '400' }}>{day.day}</Text>
                    </Text>
                    <Muted style={{ fontSize: 12 }}>
                      In {fmtTime(day.punch_in)} · Out {fmtTime(day.punch_out)} · {hours(day.working_hours)}
                    </Muted>
                  </View>
                  <Badge
                    label={day.status ? (ATTENDANCE_STATUS[day.status] ?? day.status) : 'Not marked'}
                    tone={toneOf(day.status)}
                  />
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
