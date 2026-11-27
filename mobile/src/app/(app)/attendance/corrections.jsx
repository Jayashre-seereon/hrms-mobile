import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Switch, Text, TextInput, View } from 'react-native';
import { listPunches, regularisePunch } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Muted } from '@/ui/components';
import { fmtDate, fmtTime } from '@/ui/format';
import { DateField, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/**
 * HR direct correction (web: PunchCorrectionsCard): missed punch-outs of all employees in scope,
 * fixed with POST /attendance/punches/{id}/regularise. "+" adds or corrects a punch for any employee.
 */
export default function CorrectionsScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['attendance', 'punches', 'missed'],
    queryFn: () => listPunches({ missed: true, page: 1, limit: 50 }),
    retry: (count, err) => err.response?.status !== 403 && count < 1,
  });
  const forbidden = query.error?.response?.status === 403;
  const [target, setTarget] = useState(null);
  const [outTime, setOutTime] = useState('');
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState('');
  const fix = useMutation({
    mutationFn: () => regularisePunch(target.id, { out_time: outTime, next_day: nextDay, reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setTarget(null);
      Alert.alert('Punch corrections', 'Punch-out recorded');
    },
  });
  const openFix = (p) => {
    setTarget(p);
    setOutTime('');
    setNextDay(false);
    setReason('');
    fix.reset();
  };
  if (forbidden) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Header title="Punch corrections" />
        <Muted>Punch corrections are for HR / admins. You do not have access to this.</Muted>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Header title="Punch corrections" />
      <QueryList
        query={query}
        empty="No missed punch-outs. Use + to add or correct a punch."
        header={<Muted>Missed punch-outs — set the actual out time.</Muted>}
        renderItem={(p) => (
          <ItemCard
            title={`${p.employee_name ?? p.employee?.full_name ?? 'Employee'}${p.employee_code ? ` · ${p.employee_code}` : ''}`}
            badge={p.regularisation?.status ? <Badge2 label={`Request: ${p.regularisation.status}`} /> : null}
            lines={[`${fmtDate(p.date)} · in ${fmtTime(p.in_time)}`]}
            onPress={() => openFix(p)}
          />
        )}
      />
      <Fab onPress={() => router.push('/attendance/corrections-new')} />

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 12 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Set punch-out</Text>
            <Muted>
              {target?.employee_name ?? 'Employee'} · {fmtDate(target?.date)} · in {fmtTime(target?.in_time)}
            </Muted>
            <DateField label="Out time" mode="time" value={outTime} onChange={setOutTime} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>Next day</Text>
              <Switch value={nextDay} onValueChange={setNextDay} />
            </View>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              placeholderTextColor={c.muted}
              style={{
                height: 48,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                color: c.text,
              }}
            />
            {fix.error ? <ErrorText>{errorMessage(fix.error)}</ErrorText> : null}
            <Button
              title="Save"
              onPress={() => fix.mutate()}
              loading={fix.isPending}
              disabled={!outTime || !reason.trim()}
            />
            <Button title="Cancel" variant="outline" onPress={() => setTarget(null)} />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
function Badge2({ label }) {
  return <Muted style={{ fontSize: 12 }}>{label}</Muted>;
}
