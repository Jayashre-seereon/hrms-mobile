import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { createRegularisation, getTodayStatus } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { fmtDate, fmtTime } from '@/ui/format';
import { DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/**
 * Employee request for a missed punch-out: actual out time (+ next day for night shifts) and a reason.
 * Body is the same as the web (RegularisationDialog): punch_id or date, requested_out_time, next_day, reason.
 */
export default function NewRegularisationScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams();
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus });
  const missed = (today.data?.missed_punch_outs ?? []).filter((m) => m.regularisation?.status !== 'PENDING');
  const [punchId, setPunchId] = useState(params.punch_id ?? '');
  const [date, setDate] = useState(params.date ?? '');
  const [outTime, setOutTime] = useState('');
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState('');
  const selected = missed.find((m) => String(m.punch_id) === punchId);
  const save = useMutation({
    mutationFn: () =>
      createRegularisation({
        ...(punchId ? { punch_id: punchId } : { date }),
        requested_out_time: outTime,
        next_day: nextDay,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      Alert.alert('Regularisation', 'Regularisation request sent');
      router.back();
    },
  });
  const valid = (punchId || date) && outTime && reason.trim();
  return (
    <Page>
      <Header title="Request regularisation" />
      <Card style={{ gap: 16 }}>
        {missed.length ? (
          <Select
            label="Missed punch-out"
            value={punchId}
            onChange={(v) => {
              setPunchId(v);
              setDate('');
            }}
            placeholder="Pick a day"
            options={missed.map((m) => ({
              label: `${fmtDate(m.date)} · in ${fmtTime(m.in_time)}`,
              value: String(m.punch_id),
            }))}
          />
        ) : null}
        {!punchId ? (
          <DateField label={missed.length ? 'Or another date' : 'Date'} value={date} onChange={setDate} />
        ) : (
          <Muted>
            {fmtDate(selected?.date ?? params.date)} · punched in at {fmtTime(selected?.in_time ?? params.in_time)}
          </Muted>
        )}
        <DateField label="Actual punch-out time" mode="time" value={outTime} onChange={setOutTime} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Next day</Text>
            <Muted style={{ fontSize: 12 }}>Turn on if you left after midnight (night shift).</Muted>
          </View>
          <Switch value={nextDay} onValueChange={setNextDay} />
        </View>
        <Field
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Why was the punch-out missed?"
          multiline
        />
        {save.error ? <ErrorText>{errorMessage(save.error, 'Could not send the request.')}</ErrorText> : null}
        <Button title="Send request" onPress={() => save.mutate()} loading={save.isPending} disabled={!valid} />
      </Card>
    </Page>
  );
}
