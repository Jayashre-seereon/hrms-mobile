import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';

import { getMySummary, getTodayStatus } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { displayName, profileOf, useSession } from '@/store/session';
import { Button, Card, ErrorText, Loading, Muted, Screen } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { useColors } from '@/ui/theme';

function Stat({ label, value }: { label: string; value?: number | string }) {
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

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus });
  const summary = useQuery({ queryKey: ['attendance', 'my-summary'], queryFn: () => getMySummary() });

  const refreshing = today.isRefetching || summary.isRefetching;
  const onRefresh = () => {
    today.refetch();
    summary.refetch();
  };

  const firstName = displayName(me).split(' ')[0];
  const t = today.data;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={{ backgroundColor: c.primary, borderRadius: 16, padding: 20, gap: 4 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Hi, {firstName} 👋</Text>
        <Text style={{ color: '#ffffffcc', fontSize: 14 }}>
          {[p.designation, p.department].filter(Boolean).join(' · ') || new Date().toDateString()}
        </Text>
      </View>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Today</Text>
        {today.isLoading ? (
          <Loading />
        ) : today.error ? (
          <ErrorText>{errorMessage(today.error, 'Could not load today’s status.')}</ErrorText>
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
        ) : summary.error ? (
          <ErrorText>{errorMessage(summary.error, 'Could not load the attendance summary.')}</ErrorText>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Present" value={summary.data?.present_days} />
            <Stat label="Absent" value={summary.data?.absent_days} />
            <Stat label="Leave" value={summary.data?.leave_days} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
