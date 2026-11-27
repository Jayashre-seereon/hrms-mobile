import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getOrgDashboardCards } from '@/api/admin/companies';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { displayName, useSession } from '@/store/session';
import { Button, ErrorText, Loading, Muted } from '@/ui/components';
import { Hero, Pill, QuickAction, SectionHeader, StatTile } from '@/ui/dashboard';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/** Headcount trend as small bars (web: sparkline). */
function Trend({ values }) {
  const c = useColors();
  if (!values?.length || values.length < 2) return <Muted style={{ fontSize: 11.5 }}>No headcount trend yet</Muted>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 30 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 5 + ((v - min) / span) * 25,
            backgroundColor: i === values.length - 1 ? c.gold : c.primary,
            borderRadius: 3,
            opacity: 0.85,
          }}
        />
      ))}
    </View>
  );
}

function Stat({ value, label }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{value}</Text>
      <Muted style={{ fontSize: 11.5 }}>{label}</Muted>
    </View>
  );
}

function Panel({ children, style }) {
  const c = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.primaryDark }, style]}>
      {children}
    </View>
  );
}

/**
 * Organisation dashboard for a Super Admin (web OrgDashboard, /org/dashboard in organisation mode):
 * totals + one card per company from GET /org/dashboard (company list fallback); "Open company" picks it.
 */
export default function OrgDashboardScreen() {
  const c = useColors();
  const router = useRouter();
  const { isSuperAdmin } = useAccess();
  const me = useSession((s) => s.me);
  const selectCompany = useSession((s) => s.selectCompany);
  const [opening, setOpening] = useState('');
  const q = useQuery({ queryKey: ['admin', 'org-dashboard'], queryFn: getOrgDashboardCards, enabled: isSuperAdmin });
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('auto');
    }, []),
  );
  if (!isSuperAdmin) {
    return (
      <Page>
        <Header title="Organisation dashboard" />
        <Muted>Only a Super Admin can see the organisation dashboard.</Muted>
      </Page>
    );
  }
  const cards = q.data ?? [];
  const employees = cards.reduce((a, x) => a + x.employees, 0);
  const active = cards.reduce((a, x) => a + x.activeEmployees, 0);
  const activeCompanies = cards.filter((x) => x.active).length;
  const open = async (co) => {
    setOpening(co.id);
    try {
      await selectCompany(co.id, co.name);
    } finally {
      setOpening('');
    }
    router.push('/admin');
  };
  const shortcuts = [
    { icon: 'business-outline', label: 'Companies', href: '/admin/companies', tone: 'primary' },
    { icon: 'cube-outline', label: 'Company modules', href: '/admin/companies/modules', tone: 'info' },
    { icon: 'bar-chart-outline', label: 'Reports', href: '/admin/org-reports', tone: 'gold' },
    { icon: 'ribbon-outline', label: 'Org profile', href: '/admin/organisation', tone: 'violet' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false, title: 'Organisation dashboard' }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor="#fff"
            colors={[c.primary]}
          />
        }>
        <Hero
          name={displayName(me)}
          subtitle="Super Admin · Organisation"
          right={
            router.canGoBack() ? (
              <Ionicons
                name="close"
                size={24}
                color="#FFFFFFCC"
                onPress={() => router.back()}
                style={{ width: 40, textAlign: 'right' }}
              />
            ) : undefined
          }
        />
        <View style={styles.body}>
          <Panel style={{ marginTop: -40 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>Organisation dashboard</Text>
            <Muted style={{ fontSize: 13 }}>
              Companies at a glance. Open a company to work with its employees, roles, masters, attendance and payroll.
            </Muted>
            <View style={styles.qaGrid}>
              {shortcuts.map((s) => (
                <QuickAction key={s.href} {...s} onPress={() => router.push(s.href)} />
              ))}
            </View>
          </Panel>

          {q.isLoading ? <Loading /> : null}
          {q.error ? <ErrorText>{errorMessage(q.error, 'Could not load the organisation data.')}</ErrorText> : null}
          {!q.isLoading && !q.error && !cards.length ? (
            <Panel>
              <Muted>No companies yet.</Muted>
              <Button title="Create a company" onPress={() => router.push('/admin/companies/form')} />
            </Panel>
          ) : null}

          {cards.length ? (
            <>
              <View style={styles.tiles}>
                <StatTile
                  icon="business-outline"
                  label="Companies"
                  value={cards.length}
                  hint={`${activeCompanies} active`}
                  tone="primary"
                  onPress={() => router.push('/admin/companies')}
                />
                <StatTile icon="people-outline" label="Employees" value={employees} tone="info" />
                <StatTile icon="person-outline" label="Active employees" value={active} tone="gold" />
              </View>

              <SectionHeader title="Companies" action="Manage" onAction={() => router.push('/admin/companies')} />
              {cards.map((co) => (
                <Panel key={co.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.coIcon, { backgroundColor: c.primarySoft }]}>
                      <Text style={{ color: c.primary, fontWeight: '800', fontSize: 16 }}>
                        {co.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: c.text, fontWeight: '800', fontSize: 15.5 }}>
                        {co.name}
                      </Text>
                      {co.code ? <Muted style={{ fontSize: 12 }}>{co.code}</Muted> : null}
                    </View>
                    <Pill label={co.active ? 'Active' : 'Disabled'} tone={co.active ? 'primary' : 'danger'} />
                  </View>
                  <View style={[styles.statRow, { backgroundColor: c.mutedBg }]}>
                    <Stat value={co.employees} label="Employees" />
                    <Stat value={co.activeEmployees} label="Active" />
                    <Stat value={co.branches} label="Branches" />
                  </View>
                  <Trend values={co.trend} />
                  <Button
                    title="Open company"
                    variant="outline"
                    disabled={!co.active}
                    loading={opening === co.id}
                    onPress={() => open(co)}
                  />
                </Panel>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, gap: 14 },
  panel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  coIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', borderRadius: 12, paddingVertical: 10 },
});
