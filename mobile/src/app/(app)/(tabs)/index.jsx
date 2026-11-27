import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { getMySummary, getTodayStatus } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { isOrgUser } from '@/lib/access';
import { CompanySwitcherRow } from '@/lib/CompanyScopeNotice';
import { displayName, profileOf, useSession } from '@/store/session';
import { Button, Card, ErrorText, Loading, Muted, Screen } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { isNoEmployeeProfile } from '@/ui/NoEmployeeProfile';
import { useColors } from '@/ui/theme';
/** User id that was already sent to the admin dashboard once (like the web's redirect_portal after sign-in). */
let landedAdminFor = null;
function Stat({ label, value }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{value ?? '—'}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}
export default function HomeScreen() {
  const c = useColors();
  const router = useRouter();
  const me = useSession((s) => s.me);
  const p = profileOf(me);
  // Web: an admin / HR account goes to the admin portal and never calls the self-service attendance APIs.
  // Same here when the account has no linked employee record (employee_id null in /me).
  const adminOnly = isOrgUser(me) && !p.employee_id;
  useEffect(() => {
    if (adminOnly && me?.id && landedAdminFor !== me.id) {
      landedAdminFor = me.id;
      router.push('/admin');
    }
  }, [adminOnly, me?.id, router]);
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus, enabled: !adminOnly });
  const summary = useQuery({
    queryKey: ['attendance', 'my-summary'],
    queryFn: () => getMySummary(),
    enabled: !adminOnly,
  });
  const refreshing = today.isRefetching || summary.isRefetching;
  const onRefresh = () => {
    if (adminOnly) return;
    today.refetch();
    summary.refetch();
  };
  const firstName = displayName(me).split(' ')[0];
  // Like the web dashboard: an account without a linked employee record (403 "No employee profile")
  // just shows the dashboard with empty values instead of an error.
  const noProfile = isNoEmployeeProfile(today.error) || isNoEmployeeProfile(summary.error);
  const todayError = isNoEmployeeProfile(today.error) ? null : today.error;
  const summaryError = isNoEmployeeProfile(summary.error) ? null : summary.error;
  const t = today.data;
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={{ backgroundColor: c.primary, borderRadius: 16, padding: 20, gap: 4 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Hi, {firstName} 👋</Text>
        <Text style={{ color: '#ffffffcc', fontSize: 14 }}>
          {[p.designation, p.department].filter(Boolean).join(' · ') || new Date().toDateString()}
        </Text>
      </View>

      <CompanySwitcherRow />

      {adminOnly ? (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Admin</Text>
          <Muted>
            This account manages the organisation. Attendance, leave and payslips need a linked employee profile.
          </Muted>
          <Button title="Open admin dashboard" onPress={() => router.push('/admin')} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Today</Text>
            {today.isLoading ? (
              <Loading />
            ) : todayError ? (
              <ErrorText>{errorMessage(todayError, 'Could not load today’s status.')}</ErrorText>
            ) : (
              <>
                <Muted>
                  {t?.is_punched_in
                    ? `Punched in at ${fmtTime(t.active_punch?.in_time)}`
                    : 'You have not punched in yet.'}
                </Muted>
                {t?.shift?.name ? (
                  <Muted>
                    Shift: {t.shift.name}
                    {t.shift.start_time ? ` (${fmtTime(t.shift.start_time)} – ${fmtTime(t.shift.end_time)})` : ''}
                  </Muted>
                ) : null}
              </>
            )}
            <Button
              title={t?.is_punched_in ? 'Go to punch out' : 'Go to punch in'}
              onPress={() => router.navigate('/attendance')}
            />
          </Card>

          <Card>
            <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>This month</Text>
            {summary.isLoading ? (
              <Loading />
            ) : summaryError ? (
              <ErrorText>{errorMessage(summaryError, 'Could not load the attendance summary.')}</ErrorText>
            ) : (
              <View style={{ flexDirection: 'row' }}>
                <Stat label="Present" value={summary.data?.present_days} />
                <Stat label="Absent" value={summary.data?.absent_days} />
                <Stat label="Leave" value={summary.data?.leave_days} />
              </View>
            )}
          </Card>
          {noProfile ? (
            <Muted style={{ textAlign: 'center' }}>Your employee profile is not linked yet — ask HR.</Muted>
          ) : null}
        </>
      )}
    </Screen>
  );
}
