import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  calendarError,
  createHolidayCalendar,
  getHolidayCalendar,
  HOLIDAY_PAY_TYPES,
  HOLIDAY_TYPES,
  updateHolidayCalendar,
} from '@/api/admin/masters-extra';
import { nameError } from '@/features/masters/validation';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const NEW_CALENDAR = () => ({
  name: '',
  type: 'National',
  year: new Date().getFullYear(),
  payType: 'Paid',
  holidays: [],
});
/** Create / edit / view one holiday calendar: /admin/masters/holiday-calendars/form[?id=…] */
export default function HolidayCalendarForm() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const { can } = useAccess();
  const canEdit = can('attendance.edit');
  // GET /{id}: the latest copy before edit (web openCalendar).
  const item = useQuery({
    queryKey: ['admin', 'masters', 'holiday-calendar', id],
    queryFn: () => getHolidayCalendar(String(id)),
    enabled: editing,
  });
  const [cal, setCal] = useState(editing ? null : NEW_CALENDAR());
  const [error, setError] = useState('');
  useEffect(() => {
    if (editing && item.data && !cal) {
      const { id: _id, ...rest } = item.data;
      setCal({ ...rest, payType: rest.payType ?? 'Paid' });
    }
  }, [editing, item.data, cal]);
  const save = useMutation({
    mutationFn: (draft) => (editing ? updateHolidayCalendar(String(id), draft) : createHolidayCalendar(draft)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'masters', 'holiday-calendars'] });
      qc.invalidateQueries({ queryKey: ['admin', 'masters', 'holiday-calendar', id] });
      qc.invalidateQueries({ queryKey: ['holidays'] });
      router.back();
    },
    onError: (err) => setError(errorMessage(err, 'Unable to save the holiday calendar.')),
  });
  const title = editing ? (canEdit ? 'Edit holiday calendar' : 'Holiday calendar') : 'New holiday calendar';
  if (editing && (item.isLoading || (!cal && !item.error))) {
    return (
      <Page>
        <Header title={title} />
        <Loading />
      </Page>
    );
  }
  if (editing && item.error) {
    return (
      <Page>
        <Header title={title} />
        <ErrorText>{errorMessage(item.error, 'Unable to load the holiday calendar.')}</ErrorText>
      </Page>
    );
  }
  if (!cal) return null;
  const set = (patch) => setCal((prev) => ({ ...prev, ...patch }));
  const setHoliday = (i, patch) =>
    set({ holidays: cal.holidays.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  const addHoliday = () => set({ holidays: [...cal.holidays, { date: '', name: '' }] });
  const removeHoliday = (i) => set({ holidays: cal.holidays.filter((_, idx) => idx !== i) });
  const submit = () => {
    if (!cal.name.trim()) return setError('Calendar name is required.');
    const problem = calendarError(cal, nameError);
    if (problem) return setError(problem);
    setError('');
    save.mutate({ ...cal, year: Number(cal.year) });
  };
  if (!canEdit) {
    return (
      <Page>
        <Header title={title} />
        <Card style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{cal.name}</Text>
          <Muted>{[cal.type, String(cal.year), cal.payType].filter(Boolean).join(' · ')}</Muted>
        </Card>
        {cal.holidays.map((h, i) => (
          <Card key={`${h.date}-${i}`} style={{ gap: 2 }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{h.name}</Text>
            <Muted>{fmtDate(h.date)}</Muted>
          </Card>
        ))}
      </Page>
    );
  }
  return (
    <Page>
      <Header title={title} />
      <Card style={{ gap: 16 }}>
        <Field
          label="Calendar name *"
          value={cal.name}
          onChangeText={(v) => set({ name: v })}
          placeholder="e.g. India Holidays"
        />
        <Select
          label="Type"
          value={cal.type}
          options={HOLIDAY_TYPES.map((t) => ({ label: t, value: t }))}
          onChange={(v) => set({ type: v })}
        />
        <Field
          label="Year"
          value={String(cal.year)}
          onChangeText={(v) => set({ year: Number(v.replace(/\D/g, '').slice(0, 4)) || '' })}
          keyboardType="number-pad"
        />
        <Select
          label="Paid / unpaid"
          value={cal.payType}
          options={HOLIDAY_PAY_TYPES.map((t) => ({ label: t, value: t }))}
          onChange={(v) => set({ payType: v })}
        />
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>Holidays ({cal.holidays.length})</Text>
        <Pressable onPress={addHoliday} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="add-circle-outline" size={20} color={c.primary} />
          <Text style={{ color: c.primary, fontWeight: '600' }}>Add holiday</Text>
        </Pressable>
      </View>
      {cal.holidays.length === 0 ? <Muted>No holidays yet. Tap “Add holiday”.</Muted> : null}
      {cal.holidays.map((h, i) => (
        <Card key={i} style={{ gap: 12 }}>
          <DateField label="Date" value={h.date} onChange={(v) => setHoliday(i, { date: v })} />
          <Field
            label="Holiday name"
            value={h.name}
            onChangeText={(v) => setHoliday(i, { name: v })}
            placeholder="e.g. Republic Day"
          />
          <Pressable onPress={() => removeHoliday(i)} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ color: c.danger, fontWeight: '600' }}>Remove</Text>
          </Pressable>
        </Card>
      ))}

      <ErrorText>{error}</ErrorText>
      <Button title={editing ? 'Save calendar' : 'Create calendar'} onPress={submit} loading={save.isPending} />
    </Page>
  );
}
