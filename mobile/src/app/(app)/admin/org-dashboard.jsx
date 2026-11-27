import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { getOrgDashboardCards } from '@/api/admin/companies';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { useSession } from '@/store/session';
import { Button, Card, ErrorText, Loading, Muted } from '@/ui/components';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
function Kpi({ label, value }) {
  const c = useColors();
  return (
    <Card style={{ flexBasis: '30%', flexGrow: 1, gap: 4 }}>
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '700' }}>{value}</Text>
    </Card>
  );
}
/** Headcount trend as small bars (web: sparkline). */
function Trend({ values }) {
  const c = useColors();
  if (!values?.length || values.length < 2) return <Muted style={{ fontSize: 11 }}>No trend yet</Muted>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 28 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4 + ((v - min) / span) * 24, backgroundColor: c.primary, borderRadius: 2, opacity: 0.8 }}
        />
      ))}
    </View>
  );
}
function Stat({ value, label }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{value}</Text>
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
    </View>
  );
}
/** Organisation dashboard for a Super Admin in organisation mode (web OrgDashboard, GET /org/dashboard). */
export default function OrgDashboardScreen() {
  const c = useColors();
  const router = useRouter();
  const { isSuperAdmin } = useAccess();
  const selectCompany = useSession((s) => s.selectCompany);
  const [opening, setOpening] = useState('');
  const q = useQuery({ queryKey: ['admin', 'org-dashboard'], queryFn: getOrgDashboardCards, enabled: isSuperAdmin });
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
  const open = async (co) => {
    setOpening(co.id);
    try {
      await selectCompany(co.id, co.name);
    } finally {
      setOpening('');
    }
    router.push('/admin');
  };
  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Organisation dashboard" />
      <Muted>Companies at a glance. Open a company to work with its employees, roles, masters, attendance and payroll.</Muted>
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorText>{errorMessage(q.error, 'Could not load the organisation data.')}</ErrorText> : null}
      {!q.isLoading && !q.error && !cards.length ? <Muted>No companies yet. Create one under Companies.</Muted> : null}
      {cards.length ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Kpi label="Companies" value={cards.length} />
            <Kpi label="Employees" value={employees} />
            <Kpi label="Active employees" value={active} />
          </View>
          {cards.map((co) => (
            <Card key={co.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontWeight: '600', fontSize: 15, flexShrink: 1, color: c.text }}>{co.name}</Text>
                <Badge label={co.active ? 'Active' : 'Disabled'} tone={co.active ? 'success' : 'muted'} />
              </View>
              <View style={{ flexDirection: 'row' }}>
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
            </Card>
          ))}
        </>
      ) : null}
    </Page>
  );
}
