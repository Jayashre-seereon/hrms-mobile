import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { createPattern, getPattern, patchPattern } from '@/api/admin/compliance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
// Web "New pattern" defaults.
const EMPTY = { name: '', workingDays: '26', paidLeaveDays: '2', weeklyOffs: '4', lopEnabled: true, description: '' };
const toForm = (p) => ({
  name: p.name,
  workingDays: String(p.workingDays),
  paidLeaveDays: String(p.paidLeaveDays),
  weeklyOffs: String(p.weeklyOffs),
  lopEnabled: p.lopEnabled,
  description: p.description,
});
/** Create (POST) / edit (PATCH changed fields only) an attendance pattern — web PatternsTab dialog. */
export default function PatternFormScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const item = useQuery({
    queryKey: ['admin', 'compliance', 'pattern', id],
    queryFn: () => getPattern(String(id)),
    enabled: editing,
  });
  const [v, setV] = useState(editing ? null : EMPTY);
  const original = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (editing && item.data && !v) {
      original.current = item.data;
      setV(toForm(item.data));
    }
  }, [editing, item.data, v]);
  const save = useMutation({
    mutationFn: (form) => (editing ? patchPattern(String(id), form, original.current) : createPattern(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'patterns'] });
      qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'pattern'] });
      router.back();
    },
    onError: (err) => setError(errorMessage(err, 'Unable to save the attendance pattern.')),
  });
  const title = editing ? 'Edit attendance pattern' : 'New attendance pattern';
  if (editing && !v) {
    return (
      <Page>
        <Header title={title} />
        {item.error ? <ErrorText>{errorMessage(item.error, 'Could not load the pattern.')}</ErrorText> : <Loading />}
      </Page>
    );
  }
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const submit = () => {
    const wd = Number(v.workingDays);
    const wo = Number(v.weeklyOffs);
    const pl = Number(v.paidLeaveDays);
    // Same rules as the web Save button.
    if (!v.name.trim()) return setError('Pattern name is required.');
    if (!Number.isFinite(wd) || wd < 1 || wd > 31) return setError('Working days must be between 1 and 31.');
    if (!Number.isFinite(wo) || wo < 0) return setError('Weekly offs cannot be negative.');
    if (!Number.isFinite(pl) || pl < 0) return setError('Paid absences cannot be negative.');
    if (wd + wo > 31) return setError('Working days plus weekly offs cannot exceed 31.');
    setError('');
    save.mutate(v);
  };
  return (
    <Page>
      <Header title={title} />
      <Muted>Changing a pattern affects every employee assigned to it from the next payroll check.</Muted>
      <Card style={{ gap: 16 }}>
        <Field
          label="Pattern name *"
          value={v.name}
          onChangeText={(x) => set('name', x)}
          placeholder="e.g. Onsite support — 26 days, no paid leave"
        />
        <Field
          label="Working days / month *"
          value={v.workingDays}
          onChangeText={(x) => set('workingDays', x)}
          keyboardType="number-pad"
        />
        <Field
          label="Weekly offs / month"
          value={v.weeklyOffs}
          onChangeText={(x) => set('weeklyOffs', x)}
          keyboardType="number-pad"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Deduct LOP beyond paid days</Text>
            <Muted style={{ fontSize: 12 }}>Absences beyond the paid allowance become loss of pay.</Muted>
          </View>
          <Switch value={!!v.lopEnabled} onValueChange={(x) => set('lopEnabled', x)} />
        </View>
        <Field
          label="Description"
          value={v.description}
          onChangeText={(x) => set('description', x)}
          multiline
        />
        <ErrorText>{error}</ErrorText>
        <Button title={editing ? 'Save changes' : 'Create pattern'} onPress={submit} loading={save.isPending} />
      </Card>
    </Page>
  );
}
