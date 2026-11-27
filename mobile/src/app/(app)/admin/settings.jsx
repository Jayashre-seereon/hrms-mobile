import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { listSettings, saveSetting } from '@/api/admin/administration';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/**
 * Organization settings (GET/POST /admin/settings, permission "settings.manage"). The backend stores every setting
 * as a string key/value pair; "true"/"false" values get a switch and numeric values a number keyboard, but what is
 * saved is always the string.
 */
const isBool = (v) => /^(true|false)$/i.test(String(v ?? '').trim());
const isNum = (v) => String(v ?? '').trim() !== '' && !Number.isNaN(Number(v));
function SettingCard({ setting }) {
  const c = useColors();
  const qc = useQueryClient();
  const original = String(setting.setting_value ?? '');
  const [value, setValue] = useState(original);
  const [error, setError] = useState('');
  const bool = isBool(original);
  const save = useMutation({
    mutationFn: (v) => saveSetting({ key: setting.setting_key, value: v }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (e) => {
      setValue(original);
      setError(errorMessage(e, 'Could not save the setting.'));
    },
  });
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>{setting.setting_key}</Text>
          {setting.description ? <Muted>{setting.description}</Muted> : null}
        </View>
        {bool ? (
          <Switch
            value={value.trim().toLowerCase() === 'true'}
            disabled={save.isPending}
            trackColor={{ true: c.primary, false: c.border }}
            onValueChange={(on) => {
              const next = on ? 'true' : 'false';
              setValue(next);
              save.mutate(next);
            }}
          />
        ) : null}
      </View>
      {!bool ? (
        <>
          <Field
            label="Value"
            value={value}
            onChangeText={setValue}
            keyboardType={isNum(original) ? 'numeric' : 'default'}
            autoCapitalize="none"
            multiline={original.length > 60}
          />
          {value !== original ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="outline" onPress={() => setValue(original)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Save"
                  loading={save.isPending}
                  onPress={() => {
                    if (isNum(original) && !isNum(value)) return setError('Enter a number.');
                    save.mutate(value);
                  }}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
function AddSetting({ existingKeys }) {
  const c = useColors();
  const qc = useQueryClient();
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const add = useMutation({
    mutationFn: () => saveSetting({ key, value, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      Alert.alert('Settings', `Setting "${key.trim()}" saved.`);
      setKey('');
      setValue('');
      setDescription('');
      setError('');
    },
    onError: (e) => setError(errorMessage(e, 'Could not save the setting.')),
  });
  const onAdd = () => {
    const k = key.trim();
    if (!k) return setError('Enter a setting key.');
    if (k.length > 100) return setError('The key can be at most 100 characters.');
    if (existingKeys.includes(k)) return setError('This key already exists — edit it above.');
    setError('');
    add.mutate();
  };
  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Add a setting</Text>
      <Field label="Key" value={key} onChangeText={setKey} autoCapitalize="none" maxLength={100} />
      <Field label="Value" value={value} onChangeText={setValue} autoCapitalize="none" />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} />
      <ErrorText>{error}</ErrorText>
      <Button title="Add setting" onPress={onAdd} loading={add.isPending} />
    </Card>
  );
}
export default function AdminSettingsScreen() {
  const { can } = useAccess();
  const allowed = can('settings.manage');
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: listSettings, enabled: allowed });
  const rows = [...(q.data ?? [])].sort((a, b) => String(a.setting_key).localeCompare(String(b.setting_key)));
  return (
    <View style={{ flex: 1 }}>
      <Header title="Settings" />
      <Page onRefresh={allowed ? () => q.refetch() : undefined} refreshing={q.isRefetching}>
        {!allowed ? (
          <ErrorText>You do not have permission to manage organization settings (settings.manage).</ErrorText>
        ) : (
          <>
            <Muted>Organization-wide configuration values. Changes apply to your whole organization.</Muted>
            {q.isLoading ? <Loading /> : null}
            {q.error ? <ErrorText>{errorMessage(q.error, 'Could not load settings.')}</ErrorText> : null}
            {!q.isLoading && !q.error && rows.length === 0 ? <Muted>No settings saved yet.</Muted> : null}
            {rows.map((s) => (
              <SettingCard key={`${s.id}:${s.setting_value}`} setting={s} />
            ))}
            {!q.error ? <AddSetting existingKeys={rows.map((s) => s.setting_key)} /> : null}
          </>
        )}
      </Page>
    </View>
  );
}
