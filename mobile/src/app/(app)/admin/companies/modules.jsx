import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  getCompanyModules,
  listCompanies,
  moduleLabel,
  optionalOf,
  updateCompanyModules,
} from '@/api/admin/companies';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Loading, Muted } from '@/ui/components';
import { Header, ItemCard, Page, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Core (locked) + optional module checkboxes — web ModuleChooser. */
function ModuleChooser({ core, optional, value, onChange }) {
  const c = useColors();
  const allOn = optional.length > 0 && optional.every((k) => value.includes(k));
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 8 }}>
        <Text style={{ color: c.text, fontWeight: '700' }}>Core modules</Text>
        <Muted style={{ fontSize: 12 }}>Included for every company. They cannot be switched off.</Muted>
        {core.map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <Ionicons name="lock-closed" size={18} color={c.muted} />
            <Text style={{ color: c.text, flex: 1 }}>{moduleLabel(k)}</Text>
            <Muted style={{ fontSize: 12 }}>Included</Muted>
          </View>
        ))}
      </Card>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Optional modules</Text>
          <Pressable onPress={() => onChange(allOn ? [] : [...optional])}>
            <Text style={{ color: c.primary, fontWeight: '600' }}>{allOn ? 'Deselect all' : 'Select all'}</Text>
          </Pressable>
        </View>
        <Muted style={{ fontSize: 12 }}>Only the checked ones are available to this company&apos;s users.</Muted>
        {optional.map((k) => {
          const on = value.includes(k);
          return (
            <Pressable
              key={k}
              onPress={() => toggle(k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.primary : c.muted} />
              <Text style={{ color: c.text }}>{moduleLabel(k)}</Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}
/** GET / PUT /companies/{id}/modules for one company. Saving replaces the optional set (web CompanyModules). */
function ModulesEditor({ id, name }) {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'company-modules', id], queryFn: () => getCompanyModules(id) });
  const [value, setValue] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (q.data && value === null) setValue(q.data.optional);
  }, [q.data, value]);
  const save = useMutation({
    mutationFn: () => updateCompanyModules(id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
      qc.invalidateQueries({ queryKey: ['admin', 'company-modules'] });
      Alert.alert('Modules', `Modules updated for ${name || 'the company'}`);
      router.back();
    },
    onError: (err) => setError(errorMessage(err, 'Could not update the modules.')),
  });
  const title = name ? `Modules — ${name}` : 'Company modules';
  if (q.isLoading || (q.data && value === null)) {
    return (
      <Page>
        <Header title={title} />
        <Loading />
      </Page>
    );
  }
  if (q.error) {
    return (
      <Page>
        <Header title={title} />
        <ErrorText>{errorMessage(q.error, "Could not load this company's modules.")}</ErrorText>
      </Page>
    );
  }
  const submit = () => {
    const removed = q.data.optional.filter((k) => !value.includes(k));
    if (!removed.length) return save.mutate();
    Alert.alert(
      'Turn off modules',
      `Turn off ${removed.map(moduleLabel).join(', ')} for ${name || 'this company'}? Its users lose access immediately; the data is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: () => save.mutate() },
      ],
    );
  };
  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title={title} />
      <ModuleChooser core={q.data.core} optional={q.data.available} value={value} onChange={setValue} />
      <ErrorText>{error}</ErrorText>
      <Button title="Save modules" onPress={submit} loading={save.isPending} />
    </Page>
  );
}
/** Company list with their optional modules (web /org/company-modules). */
function CompanyModulesList() {
  const router = useRouter();
  const q = useQuery({ queryKey: ['admin', 'companies'], queryFn: listCompanies });
  return (
    <View style={{ flex: 1 }}>
      <Header title="Company modules" />
      <QueryList
        query={q}
        empty="No companies yet. Create one under Companies."
        header={<Muted>Core modules are on for every company. Choose the optional ones each company can use.</Muted>}
        renderItem={(co) => {
          const optional = optionalOf(co.optional_modules ?? co.enabled_modules ?? co.modules);
          return (
            <ItemCard
              title={co.name || '—'}
              lines={[optional.length ? optional.map(moduleLabel).join(', ') : 'Core modules only', 'Tap to edit modules']}
              onPress={() =>
                router.push(
                  `/admin/companies/modules?id=${encodeURIComponent(co.id)}&name=${encodeURIComponent(co.name ?? '')}`,
                )
              }
            />
          );
        }}
      />
    </View>
  );
}
export default function CompanyModulesScreen() {
  const { id, name } = useLocalSearchParams();
  const { isSuperAdmin } = useAccess();
  if (!isSuperAdmin) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Header title="Company modules" />
        <Muted>Only a Super Admin can change company modules.</Muted>
      </View>
    );
  }
  return id ? <ModulesEditor id={String(id)} name={name ? String(name) : ''} /> : <CompanyModulesList />;
}
