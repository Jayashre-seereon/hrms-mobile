import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { createMasterItem, getMasterItem, loadOptions, updateMasterItem } from '@/api/admin/masters';
import { formValues, getMaster, MasterField, payloadOf } from '@/features/masters/registry';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

function SelectField({ f, value, onChange, error }: { f: MasterField; value: string; onChange: (v: string) => void; error?: string }) {
  const src = f.optionsFrom;
  const q = useQuery({
    queryKey: ['admin', 'master-options', src?.endpoint, src?.labelKey],
    queryFn: () => loadOptions(src!.endpoint, src!.labelKey, src!.valueKey),
    enabled: !!src,
  });
  const options = src ? (q.data ?? []) : (f.options ?? []).map((o) => ({ label: o, value: o }));
  // Keep a saved value visible even when it is not in the loaded list.
  const withCurrent = value && !options.some((o) => o.value === value) ? [{ label: value, value }, ...options] : options;
  return (
    <Select
      label={f.label + (f.required ? ' *' : '')}
      value={value}
      options={withCurrent}
      onChange={onChange}
      placeholder={q.isLoading ? 'Loading…' : 'Select…'}
      error={error ?? (q.error ? errorMessage(q.error, 'Could not load options.') : undefined)}
    />
  );
}

/** Create / edit form for any master in the registry: /admin/masters/form?key=…[&id=…] */
export default function MasterFormScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { key, id } = useLocalSearchParams<{ key: string; id?: string }>();
  const m = getMaster(String(key));
  const editing = !!id;

  const item = useQuery({
    queryKey: ['admin', 'master-item', key, id],
    queryFn: () => getMasterItem(m!.endpoint, String(id)),
    enabled: !!m && editing,
  });

  const [values, setValues] = useState<Record<string, any> | null>(m && !editing ? formValues(m) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (m && editing && item.data && !values) setValues(formValues(m, item.data));
  }, [m, editing, item.data, values]);

  const save = useMutation({
    mutationFn: (body: Record<string, any>) => (editing ? updateMasterItem(m!.endpoint, String(id), body) : createMasterItem(m!.endpoint, body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'master', key] });
      qc.invalidateQueries({ queryKey: ['admin', 'master-item', key] });
      router.back();
    },
    onError: (err) => setFormError(errorMessage(err, 'Could not save.')),
  });

  if (!m) return <Muted>Unknown master.</Muted>;

  const set = (k: string, v: any) => setValues((prev) => ({ ...(prev ?? {}), [k]: v }));

  const submit = () => {
    if (!values) return;
    const errs: Record<string, string> = {};
    m.fields.forEach((f) => {
      if (f.showIf && !f.showIf(values)) return;
      if (f.required && (values[f.key] === '' || values[f.key] == null)) errs[f.key] = `${f.label} is required.`;
    });
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    save.mutate(payloadOf(m, values));
  };

  const title = `${editing ? 'Edit' : 'New'} ${m.singular.toLowerCase()}`;

  if (editing && (item.isLoading || (!values && !item.error))) {
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
        <ErrorText>{errorMessage(item.error, 'Could not load the item.')}</ErrorText>
      </Page>
    );
  }

  return (
    <Page>
      <Header title={title} />
      <Card style={{ gap: 16 }}>
        {m.fields
          .filter((f) => !f.showIf || f.showIf(values ?? {}))
          .map((f) => {
            const v = values?.[f.key];
            const label = f.label + (f.required ? ' *' : '');
            if (f.type === 'select') return <SelectField key={f.key} f={f} value={String(v ?? '')} onChange={(x) => set(f.key, x)} error={errors[f.key]} />;
            if (f.type === 'boolean')
              return (
                <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{f.label}</Text>
                  <Switch value={Boolean(v)} onValueChange={(x) => set(f.key, x)} />
                </View>
              );
            if (f.type === 'date' || f.type === 'time')
              return <DateField key={f.key} label={label} mode={f.type} value={v || ''} onChange={(x) => set(f.key, x)} error={errors[f.key]} />;
            return (
              <Field
                key={f.key}
                label={label}
                value={String(v ?? '')}
                onChangeText={(x) => set(f.key, f.uppercase ? x.toUpperCase() : x)}
                placeholder={f.placeholder}
                keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                multiline={f.type === 'textarea'}
                autoCapitalize={f.uppercase ? 'characters' : 'sentences'}
                error={errors[f.key]}
              />
            );
          })}
        <ErrorText>{formError}</ErrorText>
        <Button title={editing ? 'Save changes' : `Create ${m.singular.toLowerCase()}`} onPress={submit} loading={save.isPending} />
      </Card>
    </Page>
  );
}
