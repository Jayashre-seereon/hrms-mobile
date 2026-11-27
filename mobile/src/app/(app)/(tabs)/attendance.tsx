import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Href, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';

import { getMyPunches, getTodayStatus, punchIn, punchOut } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Loading, Muted, Screen, Title } from '@/ui/components';
import { fmtDate, fmtTime } from '@/ui/format';
import { useColors } from '@/ui/theme';

const QUICK_LINKS: { label: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Regularise', href: '/attendance/regularisation', icon: 'time-outline' },
  { label: 'Corrections', href: '/attendance/corrections', icon: 'create-outline' },
  { label: 'Comp-off', href: '/attendance/comp-off', icon: 'swap-horizontal-outline' },
  { label: 'Timesheets', href: '/timesheets', icon: 'document-text-outline' },
];

export default function AttendanceScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus });
  const punches = useQuery({
    queryKey: ['attendance', 'punches', year, month],
    queryFn: () => getMyPunches({ month, year }),
  });

  const refreshAll = () => qc.invalidateQueries({ queryKey: ['attendance'] });

  const onError = (err: unknown) => {
    const status = (err as AxiosError).response?.status;
    Alert.alert('Attendance', status === 423 ? 'Attendance for this month is locked.' : errorMessage(err));
  };

  const doPunchIn = useMutation({ mutationFn: () => punchIn(), onSuccess: refreshAll, onError });
  const doPunchOut = useMutation({ mutationFn: () => punchOut(), onSuccess: refreshAll, onError });

  const t = today.data;
  const punchedIn = Boolean(t?.is_punched_in);
  const locked = Boolean(t?.locked);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={today.isRefetching || punches.isRefetching} onRefresh={refreshAll} />
      }>
      <Title>Attendance</Title>

      <Card style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 36, fontWeight: '700', color: c.text }}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Muted>{now.toDateString()}</Muted>
        {today.isLoading ? (
          <Loading />
        ) : today.error ? (
          <ErrorText>{errorMessage(today.error, 'Could not load today’s status.')}</ErrorText>
        ) : (
          <>
            <Muted>
              {punchedIn ? `Punched in at ${fmtTime(t?.active_punch?.in_time)}` : 'Not punched in'}
              {locked ? ' · Month locked' : ''}
            </Muted>
            <View style={{ alignSelf: 'stretch' }}>
              {punchedIn ? (
                <Button
                  title="Punch out"
                  variant="danger"
                  onPress={() => doPunchOut.mutate()}
                  loading={doPunchOut.isPending}
                  disabled={locked}
                />
              ) : (
                <Button
                  title="Punch in"
                  onPress={() => doPunchIn.mutate()}
                  loading={doPunchIn.isPending}
                  disabled={locked}
                />
              )}
            </View>
          </>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {QUICK_LINKS.map((l) => (
          <Pressable
            key={l.href}
            onPress={() => router.push(l.href as Href)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 6,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Ionicons name={l.icon} size={22} color={c.primary} />
            <Text style={{ color: c.text, fontSize: 12, fontWeight: '500' }}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>This month</Text>
      {punches.isLoading ? (
        <Loading />
      ) : punches.error ? (
        <ErrorText>{errorMessage(punches.error, 'Could not load your punches.')}</ErrorText>
      ) : !punches.data?.length ? (
        <Muted>No punches yet this month.</Muted>
      ) : (
        punches.data.map((p, i) => (
          <Card key={p.id ?? `${p.date}-${i}`} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{fmtDate(p.date)}</Text>
              {p.verdict ? <Muted>{String(p.verdict)}</Muted> : null}
            </View>
            <Muted>
              In {fmtTime(p.in_time)} · Out {fmtTime(p.out_time)}
              {p.late_mins ? ` · Late ${p.late_mins}m` : ''}
            </Muted>
          </Card>
        ))
      )}
    </Screen>
  );
}
