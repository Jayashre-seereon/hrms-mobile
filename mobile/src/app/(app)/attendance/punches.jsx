import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { deleteTodayPunch, getDevices, getMyPunches, getTodayStatus, punchIn, punchOut } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { isNoEmployeeProfile, NoEmployeeProfile } from '@/ui/NoEmployeeProfile';
import { Badge, Header, Page, Segments, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const pad2 = (n) => String(n).padStart(2, '0');
const periodOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  return { value: periodOf(d), label: d.toLocaleDateString([], { month: 'long', year: 'numeric' }) };
});
const SOURCES = [
  { value: 'Manual', label: 'Manual' },
  { value: 'Biometric', label: 'Biometric device' },
];
const verdictTone = (v) =>
  v === 'Overtime' ? 'success' : v === 'Short' || v === 'Missed punch-out' ? 'danger' : v ? 'muted' : undefined;

/**
 * My punches (web: MyAttendanceView → MarkAttendanceCard): punch with source Manual / Biometric device
 * (GET /attendance/devices), month punch log (GET /attendance/my-punches) and "remove today's punch"
 * (DELETE /attendance/punches/{id}) — offered, like the web, only for today's punch in an unlocked month.
 */
export default function MyPunchesScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(MONTHS[0].value);
  const [source, setSource] = useState('Manual');
  const [device, setDevice] = useState('');
  const [note, setNote] = useState('');
  const [year, month] = period.split('-').map(Number);

  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus });
  const punches = useQuery({
    queryKey: ['attendance', 'punches', year, month],
    queryFn: () => getMyPunches({ month, year }),
  });
  const devices = useQuery({
    queryKey: ['attendance', 'devices'],
    queryFn: getDevices,
    enabled: source === 'Biometric',
  });

  const refreshAll = () => qc.invalidateQueries({ queryKey: ['attendance'] });
  const onError = (fallback) => (err) =>
    Alert.alert('Attendance', err?.response?.status === 423 ? 'Attendance for this month is locked.' : errorMessage(err, fallback));

  const t = today.data;
  const punchedIn = Boolean(t?.is_punched_in);
  const locked = Boolean(t?.locked);
  const deviceList = devices.data ?? [];
  const deviceId = device || deviceList.find((d) => d.status !== 'INACTIVE')?.id || '';
  const dev = deviceList.find((d) => d.id === deviceId);

  const doPunchIn = useMutation({
    mutationFn: () =>
      punchIn({
        source: source === 'Biometric' ? 'BIOMETRIC' : 'MANUAL',
        device_id: source === 'Biometric' ? deviceId : null,
        location_name: source === 'Manual' ? 'Self-marked · Mobile app' : (dev?.location ?? 'Biometric device'),
        note: note.trim() || undefined,
      }),
    onSuccess: (rec) => {
      setNote('');
      if (rec?.warning) Alert.alert('Attendance', rec.warning);
      refreshAll();
    },
    onError: onError('Failed to punch in'),
  });
  const doPunchOut = useMutation({
    mutationFn: () => punchOut({ note: note.trim() || undefined }),
    onSuccess: () => {
      setNote('');
      refreshAll();
    },
    onError: onError('Failed to punch out'),
  });
  const remove = useMutation({
    mutationFn: (id) => deleteTodayPunch(id),
    onSuccess: () => {
      Alert.alert('Attendance', 'Punch removed successfully.');
      refreshAll();
    },
    onError: onError('Failed to remove punch'),
  });

  const confirmRemove = (p) =>
    Alert.alert('Remove today’s punch?', `In ${fmtTime(p.in_time)}${p.out_time ? ` · Out ${fmtTime(p.out_time)}` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(p.id) },
    ]);

  const onPunch = () => {
    if (punchedIn) return doPunchOut.mutate();
    if (source === 'Biometric' && !deviceId) return Alert.alert('Attendance', 'Choose a biometric device.');
    return doPunchIn.mutate();
  };

  return (
    <Page
      onRefresh={refreshAll}
      refreshing={today.isRefetching || punches.isRefetching}>
      <Header title="My punches" />

      <Card style={{ gap: 12 }}>
        {today.isLoading ? (
          <Loading />
        ) : isNoEmployeeProfile(today.error) ? (
          <NoEmployeeProfile />
        ) : today.error ? (
          <ErrorText>{errorMessage(today.error, 'Could not load today’s status.')}</ErrorText>
        ) : (
          <>
            <Muted>
              {punchedIn ? `Punched in at ${fmtTime(t?.active_punch?.in_time)}` : 'Not punched in'}
              {locked ? ' · Month locked' : ''}
            </Muted>
            {!punchedIn ? (
              <>
                <Segments value={source} options={SOURCES} onChange={setSource} />
                {source === 'Biometric' ? (
                  devices.isLoading ? (
                    <Loading />
                  ) : devices.error ? (
                    <ErrorText>{errorMessage(devices.error, 'Could not load biometric devices.')}</ErrorText>
                  ) : (
                    <Select
                      label="Device"
                      value={deviceId}
                      placeholder="Choose a device"
                      options={deviceList.map((d) => ({
                        value: d.id,
                        label: `${d.name}${d.location ? ` · ${d.location}` : ''}${d.status === 'INACTIVE' ? ' (inactive)' : ''}`,
                      }))}
                      onChange={setDevice}
                    />
                  )
                ) : null}
              </>
            ) : null}
            <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Add a note" />
            <Button
              title={punchedIn ? 'Punch out' : 'Punch in'}
              variant={punchedIn ? 'danger' : 'primary'}
              onPress={onPunch}
              loading={doPunchIn.isPending || doPunchOut.isPending}
              disabled={locked}
            />
          </>
        )}
      </Card>

      <Select label="Month" value={period} options={MONTHS} onChange={setPeriod} />

      {punches.isLoading ? (
        <Loading />
      ) : punches.error ? (
        <ErrorText>{errorMessage(punches.error, 'Could not load your punches.')}</ErrorText>
      ) : !punches.data?.length ? (
        <Muted>No punches for this month.</Muted>
      ) : (
        punches.data.map((p, i) => {
          const canRemove = Boolean(t?.date) && p.date === t.date && !p.is_locked && p.id;
          return (
            <Card key={p.id ?? `${p.date}-${i}`} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{p.date}</Text>
                <Badge label={p.verdict} tone={verdictTone(p.verdict)} />
                {p.regularised ? <Badge label="Regularised" tone="muted" /> : null}
                {canRemove ? (
                  <Pressable onPress={() => confirmRemove(p)} hitSlop={8} accessibilityLabel="Remove today's punch">
                    <Ionicons name="trash-outline" size={20} color={c.danger} />
                  </Pressable>
                ) : null}
              </View>
              <Muted>
                In {fmtTime(p.in_time)} · Out {fmtTime(p.out_time)}
                {p.out_date && p.out_date !== p.date ? ` (${p.out_date})` : ''}
                {p.hours != null ? ` · ${Number(p.hours).toFixed(2)} h` : ''}
              </Muted>
              <Muted style={{ fontSize: 12 }}>
                {[p.source || 'Manual', p.location_name || 'Self-marked', p.shift_timing].filter(Boolean).join(' · ')}
                {p.late_mins > 0 ? ` · ${p.late_mins}m late` : ''}
                {p.early_out_mins > 0 ? ` · ${p.early_out_mins}m early` : ''}
              </Muted>
              {p.note ? <Muted style={{ fontSize: 12 }}>Note: {p.note}</Muted> : null}
            </Card>
          );
        })
      )}
    </Page>
  );
}
