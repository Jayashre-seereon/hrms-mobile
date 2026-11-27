import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { addPunch, getEmployeesForPicker, listPunches, regularisePunch } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { fmtTime } from '@/ui/format';
import { DateField, Header, Page, Select, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const empName = (e) =>
  e.full_name || e.name || [e.first_name, e.last_name].filter(Boolean).join(' ') || e.email || String(e.id);
/**
 * HR: add a missed punch or correct an existing one (web: PunchCorrectionsCard form).
 * A punch already on that day → POST /punches/{id}/regularise; otherwise → POST /punches.
 */
export default function NewCorrectionScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [empId, setEmpId] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [inAt, setInAt] = useState('09:30');
  const [outAt, setOutAt] = useState('18:30');
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState('');
  const employees = useQuery({ queryKey: ['attendance', 'employees-picker'], queryFn: getEmployeesForPicker });
  const existing = useQuery({
    queryKey: ['attendance', 'punches', 'existing', empId, date],
    queryFn: async () =>
      (await listPunches({ employee_id: empId, from: date, to: date, page: 1, limit: 5 }))[0] ?? null,
    enabled: Boolean(empId && date),
  });
  const punch = existing.data;
  const save = useMutation({
    mutationFn: () =>
      punch
        ? regularisePunch(punch.id, { out_time: outAt, in_time: inAt, next_day: nextDay, reason: reason.trim() })
        : addPunch({
            employee_id: empId,
            date,
            in_time: inAt,
            out_time: outAt,
            next_day: nextDay,
            reason: reason.trim(),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      Alert.alert('Punch corrections', punch ? 'Punch corrected' : 'Missed punch added');
      router.back();
    },
  });
  const valid = empId && date && inAt && outAt && reason.trim();
  return (
    <Page>
      <Header title="Add / correct punch" />
      <Card style={{ gap: 16 }}>
        <Select
          label="Employee"
          value={empId}
          onChange={setEmpId}
          placeholder={employees.isLoading ? 'Loading…' : 'Pick an employee'}
          options={(employees.data ?? []).map((e) => ({
            label: `${empName(e)}${e.employee_code ? ` · ${e.employee_code}` : ''}`,
            value: String(e.id),
          }))}
        />
        {employees.error ? <ErrorText>{errorMessage(employees.error, 'Could not load employees.')}</ErrorText> : null}
        <DateField label="Date" value={date} onChange={setDate} />
        {punch ? (
          <Muted>
            A punch exists on this day (in {fmtTime(punch.in_time)}, out {fmtTime(punch.out_time)}) — saving corrects
            it.
          </Muted>
        ) : empId ? (
          <Muted>No punch on this day — saving adds a missed punch.</Muted>
        ) : null}
        <DateField label="In time" mode="time" value={inAt} onChange={setInAt} />
        <DateField label="Out time" mode="time" value={outAt} onChange={setOutAt} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontWeight: '600' }}>Out time is next day</Text>
          <Switch value={nextDay} onValueChange={setNextDay} />
        </View>
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Reason for the correction" />
        {save.error ? <ErrorText>{errorMessage(save.error, 'Could not save the punch.')}</ErrorText> : null}
        <Button
          title={punch ? 'Correct punch' : 'Add punch'}
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={!valid}
        />
      </Card>
    </Page>
  );
}
