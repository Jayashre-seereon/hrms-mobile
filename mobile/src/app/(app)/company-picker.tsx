import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { api, errorMessage } from '@/lib/api';
import { setPickerOpen } from '@/lib/CompanyScopeNotice';
import { useSession } from '@/store/session';
import { Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type Company = { id: string | number; name?: string; code?: string };

const listOf = (res: any): Company[] => {
  const d = res?.data?.data ?? res?.data ?? res ?? [];
  return Array.isArray(d) ? d : (d.items ?? d.companies ?? []);
};

/** Same endpoint as the web (src/api/company.js → getCompanies). 403/404 → no companies. */
async function getCompanies(): Promise<Company[]> {
  try {
    return listOf(await api.get('/super-admin/companies'));
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 403) return [];
    throw err;
  }
}

/** Super Admin: choose the company to work in (web: CompanyPickerDialog). */
export default function CompanyPickerScreen() {
  const c = useColors();
  const router = useRouter();
  const current = useSession((s) => s.scopeCompanyId);
  const selectCompany = useSession((s) => s.selectCompany);
  const clearCompany = useSession((s) => s.clearCompany);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const companies = useQuery({ queryKey: ['companies', 'picker'], queryFn: getCompanies });

  // Closing the picker (back / swipe) clears the "Select a company" request, like closing the web dialog.
  useEffect(() => {
    setPickerOpen(true);
    return () => {
      setPickerOpen(false);
      useSession.setState({ needCompany: false });
    };
  }, []);

  const all = companies.data ?? [];
  const term = q.trim().toLowerCase();
  const shown = all.filter((co) => `${co.name ?? ''} ${co.code ?? ''}`.toLowerCase().includes(term));

  const choose = async (id: string, name: string) => {
    setBusy(true);
    try {
      await selectCompany(id, name);
    } finally {
      setBusy(false);
    }
    if (router.canGoBack()) router.back();
  };

  const leave = async () => {
    setBusy(true);
    try {
      await clearCompany();
    } finally {
      setBusy(false);
    }
    if (router.canGoBack()) router.back();
  };

  return (
    <>
      <Header title="Choose a company" />
      <FlatList
        data={shown}
        keyExtractor={(co) => String(co.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={companies.isRefetching} onRefresh={() => { companies.refetch(); }} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Muted>
              Employees, roles, master data, attendance and payroll belong to one company. Pick the one you want to work in.
            </Muted>
            <Field label="Search" value={q} onChangeText={setQ} placeholder="Search companies" autoCorrect={false} />
            {current ? (
              <Pressable onPress={leave} disabled={busy}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name="log-out-outline" size={20} color={c.danger} />
                  <Text style={{ color: c.danger, fontWeight: '600', flex: 1 }}>Exit company (organisation view)</Text>
                </Card>
              </Pressable>
            ) : null}
            {busy ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={
          companies.isLoading ? (
            <Loading />
          ) : companies.error ? (
            <ErrorText>{errorMessage(companies.error, 'Could not load companies.')}</ErrorText>
          ) : (
            <Muted style={{ textAlign: 'center' }}>{all.length ? 'No company matches.' : 'No companies yet. Create one first.'}</Muted>
          )
        }
        renderItem={({ item: co }) => {
          const isCurrent = String(co.id) === String(current);
          return (
            <Pressable
              onPress={() => choose(String(co.id), co.name ?? '')}
              disabled={busy}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: isCurrent ? c.primary : c.border }}>
                <Ionicons name="business-outline" size={20} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                    {co.name}
                  </Text>
                  {co.code ? <Muted style={{ fontSize: 12 }}>{co.code}</Muted> : null}
                </View>
                {isCurrent ? <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>Current</Text> : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </>
  );
}
