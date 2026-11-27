import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import {
  createMasterItem,
  getMasterItem,
  loadNameOptions,
  loadOptions,
  patchMasterItem,
  updateMasterItem,
} from '@/api/admin/masters';
import { formValues, getMaster, MasterConfig, MasterField, payloadOf, rowId } from '@/features/masters/registry';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const staticOptions = (f: MasterField) =>
  (f.options ?? []).map((o) => (typeof o === 'string' ? { label: o, value: o } : o));

function SelectField({ f, value, onChange, error }: { f: MasterField; value: string; onChange: (v: string) => void; error?: string }) {
  const src = f.optionsFrom;
  const q = useQuery({
    queryKey: ['admin', 'master-options', src?.endpoint, src?.labelKey, src?.names],
    queryFn: () => (src!.names ? loadNameOptions(src!.endpoint) : loadOptions(src!.endpoint, src!.labelKey, src!.valueKey)),
    enabled: !!src,
  });
  const options = src ? (q.data ?? []) : staticOptions(f);
  // Keep a saved value visible even when it is not in the loaded list (web does the same).
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

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Changed body keys between the original and the edited payload. */
function changedKeys(m: MasterConfig, before: Record<string, any>, after: Record<string, any>) {
  return Object.keys(after).filter((k) => !(m.patchSkip ?? []).includes(k) && !same(before[k], after[k]));
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
  const original = useRef<Record<string, any> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (m && editing && item.data && !values) {
      const v = formValues(m, item.data);
      original.current = v;
      setValues(v);
    }
  }, [m, editing, item.data, values]);

  const save = useMutation({
    mutationFn: async (vals: Record<string, any>) => {
      let body = payloadOf(m!, vals);
      if (!editing) {
        if (m!.beforeSave) body = await m!.beforeSave(body);
        return createMasterItem(m!.endpoint, body);
      }
      const method = m!.updateMethod ?? 'put';
      if (method === 'put') {
        if (m!.beforeSave) body = await m!.beforeSave(body);
        return updateMasterItem(m!.endpoint, String(id), body);
      }
      const before = original.current ? payloadOf(m!, original.current) : {};
      const changed = changedKeys(m!, before, body);
      if (method === 'patch-changed') {
        if (!changed.length) return null; // nothing changed: no request (web)
        const patch = Object.fromEntries(changed.map((k) => [k, body[k]]));
        // Leave types: leave_balance always follows annual_days.
        if ('annual_days' in patch && 'leave_balance' in body) patch.leave_balance = body.leave_balance;
        return patchMasterItem(m!.endpoint, String(id), patch);
      }
      // patch-single-else-put
      if (changed.length === 1) return patchMasterItem(m!.endpoint, String(id), { [changed[0]]: body[changed[0]] });
      if (m!.beforeSave) body = await m!.beforeSave(body);
      return updateMasterItem(m!.endpoint, String(id), body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'master', key] });
      qc.invalidateQueries({ queryKey: ['admin', 'master-item', key] });
      router.back();
    },
    onError: (err) => setFormError(errorMessage(err, `Unable to save the ${m?.singular.toLowerCase() ?? 'item'}.`)),
  });

  if (!m) return <Muted>Unknown master.</Muted>;

  const set = (k: string, v: any) => setValues((prev) => ({ ...(prev ?? {}), [k]: v }));

  const submit = () => {
    if (!values) return;
    const errs: Record<string, string> = {};
    const loaded: any[] = qc.getQueryData(['admin', 'master', key]) ?? [];
    m.fields.forEach((f) => {
      if (f.showIf && !f.showIf(values)) return;
      const v = values[f.key];
      if (f.required && (v === '' || v == null)) {
        errs[f.key] = `${f.label} is required.`;
        return;
      }
      const custom = f.validate?.(v, values);
      if (custom) {
        errs[f.key] = custom;
        return;
      }
      if (f.unique && String(v ?? '').trim()) {
        const wanted = String(v).trim().toLowerCase();
        const clash = loaded.some((r) => rowId(m, r) !== String(id ?? '') && String(r?.[f.key] ?? '').trim().toLowerCase() === wanted);
        if (clash) errs[f.key] = `"${String(v).trim()}" already exists in ${m.title.toLowerCase()}.`;
      }
    });
    Object.assign(errs, m.validate?.(values) ?? {});
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    save.mutate(values);
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
                <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 14, flexShrink: 1 }}>{f.label}</Text>
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
                editable={!f.disabled}
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
