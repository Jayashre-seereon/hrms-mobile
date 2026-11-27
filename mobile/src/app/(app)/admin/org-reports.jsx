import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { getOrgDashboardCards } from '@/api/admin/companies';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Card, ErrorText, Loading, Muted } from '@/ui/components';
import { Progress, SectionHeader, StatTile } from '@/ui/dashboard';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/**
 * Reports & Analytics at organisation level (web OrgReports, /org/reports in organisation mode): aggregate
 * headcount across companies from GET /org/dashboard (or the company list when the server has no such route).
 * Employee-level reports live inside each company.
 */
export default function OrgReportsScreen() {
  const c = useColors();
  const { isSuperAdmin } = useAccess();
  const q = useQuery({ queryKey: ['admin', 'org-dashboard'], queryFn: getOrgDashboardCards, enabled: isSuperAdmin });
  if (!isSuperAdmin) {
    return (
      <Page>
        <Header title="Reports & Analytics" />
        <Muted>Only a Super Admin can see organisation reports.</Muted>
      </Page>
    );
  }
  const cards = q.data ?? [];
  const max = Math.max(1, ...cards.map((x) => x.employees));
  const employees = cards.reduce((a, x) => a + x.employees, 0);
  const active = cards.reduce((a, x) => a + x.activeEmployees, 0);
  const branches = cards.reduce((a, x) => a + x.branches, 0);
  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Reports & Analytics" />
      <Muted>Aggregate numbers across companies. Employee-level reports live inside each company.</Muted>
      {q.isLoading ? <Loading /> : null}
      {q.error ? <ErrorText>{errorMessage(q.error, 'Could not load the organisation data.')}</ErrorText> : null}
      {!q.isLoading && !q.error && !cards.length ? <Muted>No companies yet.</Muted> : null}
      {cards.length ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <StatTile icon="business-outline" label="Companies" value={cards.length} tone="primary" />
            <StatTile icon="people-outline" label="Employees" value={employees} tone="info" />
            <StatTile icon="person-outline" label="Active" value={active} tone="gold" />
            <StatTile icon="git-branch-outline" label="Branches" value={branches} tone="violet" />
          </View>
          <SectionHeader title="Headcount by company" />
          <Card style={{ gap: 14 }}>
            {cards.map((co) => (
              <View key={co.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', flexShrink: 1 }}>
                    {co.name}
                  </Text>
                  <Muted style={{ fontSize: 12.5 }}>
                    {co.activeEmployees} active / {co.employees} total
                  </Muted>
                </View>
                <Progress value={co.employees / max} />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Page>
  );
}
