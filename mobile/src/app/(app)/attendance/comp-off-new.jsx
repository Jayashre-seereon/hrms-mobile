import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { getMyCompOffSummary, submitCompOffRedemption } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { DateField, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Working days (Mon–Fri) between two YYYY-MM-DD dates, inclusive; 0 when reversed — same rule as the web. */
function workDaysBetween(from, to) {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n += 1;
  }
  return n;
}
export default function NewCompOffScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const summary = useQuery({ queryKey: ['attendance', 'comp-off'], queryFn: getMyCompOffSummary });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [half, setHalf] = useState(false);
  const [reason, setReason] = useState('');
  const work = workDaysBetween(from, to);
  const days = half && from === to && work === 1 ? 0.5 : work;
  const onHold = (summary.data?.redemptions ?? [])
    .filter((r) => r.status === 'Pending Approval')
    .reduce((s, r) => s + Number(r.days || (r.half_day ? 0.5 : 1)), 0);
  const free = Math.max(0, Number(summary.data?.available ?? 0) - onHold);
  const save = useMutation({
    mutationFn: () =>
      submitCompOffRedemption({ from_date: from, to_date: to, half_day: half && from === to, reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'comp-off'] });
      Alert.alert('Comp-off', 'Comp-off redemption submitted');
      router.back();
    },
  });
  const problem =
    from && to && days === 0
      ? 'Pick working days (the range is empty or reversed).'
      : days > free
        ? `You can redeem at most ${free} day(s).`
        : '';
  const valid = from && to && days > 0 && days <= free && reason.trim();
  return (
    <Page>
      <Header title="Redeem comp-off" />
      <Card style={{ gap: 16 }}>
        <Muted>Available to redeem: {free} day(s)</Muted>
        <DateField
          label="From"
          value={from}
          onChange={(v) => {
            setFrom(v);
            if (!to || to < v) setTo(v);
          }}
        />
        <DateField label="To" value={to} onChange={setTo} />
        {from && to && from === to ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Half day</Text>
            <Switch value={half} onValueChange={setHalf} />
          </View>
        ) : null}
        {from && to ? <Muted>{days} day(s) will be redeemed</Muted> : null}
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Reason" />
        {problem ? <ErrorText>{problem}</ErrorText> : null}
        {save.error ? <ErrorText>{errorMessage(save.error, 'Could not submit the redemption.')}</ErrorText> : null}
        <Button title="Submit" onPress={() => save.mutate()} loading={save.isPending} disabled={!valid} />
      </Card>
    </Page>
  );
}
