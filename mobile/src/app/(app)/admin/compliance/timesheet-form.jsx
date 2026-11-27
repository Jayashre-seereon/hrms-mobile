import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ALL_DEPARTMENTS,
  DEFAULT_TIMESHEET_FIELDS,
  TIMESHEET_DEPARTMENTS,
  TIMESHEET_FIELDS,
  TIMESHEET_FREQUENCIES,
  createTimesheetFormat,
  getTimesheetFormat,
  updateTimesheetFormat,
} from '@/api/admin/compliance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const EMPTY = {
  name: '',
  frequency: 'Daily',
  department: '',
  fields: DEFAULT_TIMESHEET_FIELDS,
  description: '',
  active: true,
};
const opts = (list) => list.map((x) => ({ label: x, value: x }));
/** Create (POST) / edit (PUT full body) a timesheet format — web TimesheetFormatsTab dialog. */
export default function TimesheetFormScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const item = useQuery({
    queryKey: ['admin', 'compliance', 'timesheet-format', id],
    queryFn: () => getTimesheetFormat(String(id)),
    enabled: editing,
  });
  const [v, setV] = useState(editing ? null : EMPTY);
  const [error, setError] = useState('');
  useEffect(() => {
    if (editing && item.data && !v) {
      const r = item.data;
      setV({
        name: r.name,
        frequency: r.frequency || 'Daily',
        department: r.department === ALL_DEPARTMENTS ? '' : r.department,
        fields: r.fields,
        description: r.description,
        active: r.active,
      });
    }
  }, [editing, item.data, v]);
  const save = useMutation({
    mutationFn: (form) => (editing ? updateTimesheetFormat(String(id), form) : createTimesheetFormat(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'timesheet-formats'] });
      qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'timesheet-format'] });
      router.back();
    },
    onError: (err) =>
      setError(
        errorMessage(err, editing ? 'Unable to update the timesheet format.' : 'Unable to create the timesheet format.'),
      ),
  });
  const title = editing ? 'Edit timesheet format' : 'New timesheet format';
  if (editing && !v) {
    return (
      <Page>
        <Header title={title} />
        {item.error ? <ErrorText>{errorMessage(item.error, 'Could not load the format.')}</ErrorText> : <Loading />}
      </Page>
    );
  }
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const toggleField = (f) =>
    set('fields', v.fields.includes(f) ? v.fields.filter((x) => x !== f) : [...v.fields, f]);
  // Keep a saved department visible even if it is not in the fixed web list.
  const departments = opts(
    v.department && !TIMESHEET_DEPARTMENTS.includes(v.department)
      ? [v.department, ...TIMESHEET_DEPARTMENTS]
      : TIMESHEET_DEPARTMENTS,
  );
  const submit = () => {
    if (!v.name.trim()) return setError('Format name is required.');
    if (!v.fields.length) return setError('Pick at least one field.');
    setError('');
    save.mutate({ ...v, department: v.department || ALL_DEPARTMENTS });
  };
  return (
    <Page>
      <Header title={title} />
      <Card style={{ gap: 16 }}>
        <Field
          label="Format name *"
          value={v.name}
          onChangeText={(x) => set('name', x)}
          placeholder="e.g. Daily Engineering Timesheet"
        />
        <Select
          label="Frequency"
          value={v.frequency}
          options={opts(TIMESHEET_FREQUENCIES)}
          onChange={(x) => set('frequency', x)}
        />
        <Select
          label="Department"
          value={v.department}
          options={[{ label: ALL_DEPARTMENTS, value: '' }, ...departments]}
          onChange={(x) => set('department', x)}
          placeholder={ALL_DEPARTMENTS}
        />
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Fields shown to employees *</Text>
          <Muted style={{ fontSize: 12 }}>Employees will see exactly the fields selected here.</Muted>
          {TIMESHEET_FIELDS.map((f) => {
            const on = v.fields.includes(f);
            return (
              <Pressable
                key={f}
                onPress={() => toggleField(f)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.primary : c.muted} />
                <Text style={{ color: c.text, fontSize: 14 }}>{f}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Description" value={v.description} onChangeText={(x) => set('description', x)} multiline />
        <ErrorText>{error}</ErrorText>
        <Button title={editing ? 'Save changes' : 'Create format'} onPress={submit} loading={save.isPending} />
      </Card>
    </Page>
  );
}
