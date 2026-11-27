import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { attendanceToday, grievanceStats, headcount, payrollSummary } from '@/api/admin/dashboard';
import { useAccess } from '@/lib/access';
import { Card, Muted } from '@/ui/components';
import { Badge, Header, MenuRow, Page, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
function Kpi({ label, value, hint }) {
  const c = useColors();
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1, gap: 4 }}>
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '700' }}>{value ?? '—'}</Text>
      {hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
    </Card>
  );
}
const money = (v) => (v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`);
export default function AdminDashboard() {
  const router = useRouter();
  const { hasModule } = useAccess();
  const today = toISODate(new Date());
  // Each card loads on its own: one failing call only blanks that card (same as web).
  const heads = useQuery({ queryKey: ['admin', 'dash', 'headcount'], queryFn: headcount });
  const att = useQuery({ queryKey: ['admin', 'dash', 'attendance', today], queryFn: () => attendanceToday(today) });
  const pay = useQuery({
    queryKey: ['admin', 'dash', 'payroll'],
    queryFn: payrollSummary,
    enabled: hasModule('payroll'),
  });
  const griev = useQuery({ queryKey: ['admin', 'dash', 'grievances'], queryFn: grievanceStats });
  const refreshing = heads.isRefetching || att.isRefetching || pay.isRefetching || griev.isRefetching;
  const onRefresh = () => {
    heads.refetch();
    att.refetch();
    if (hasModule('payroll')) pay.refetch();
    griev.refetch();
  };
  const go = (href) => router.push(href);
  return (
    <Page onRefresh={onRefresh} refreshing={refreshing}>
      <Header title="Admin dashboard" />
      <CompanyScopeNotice message="Pick a company to see its figures — without one the cards below may be empty." />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Kpi label="Employees" value={heads.data} />
        <Kpi
          label="Present today"
          value={
            att.data?.present != null ? `${att.data.present}${att.data.total ? ` / ${att.data.total}` : ''}` : null
          }
          hint={att.data?.percent != null ? `${att.data.percent}% attendance` : null}
        />
        <Kpi label="Absent today" value={att.data?.absent} />
        <Kpi label="On leave today" value={att.data?.onLeave} />
        <Kpi
          label="Open grievances"
          value={griev.data?.totalOpen}
          hint={griev.data?.slaBreached ? `${griev.data.slaBreached} SLA breached` : null}
        />
        <Kpi label="Avg days to resolve" value={griev.data?.avgDaysToResolve} />
      </View>

      {hasModule('payroll') ? (
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>Payroll</Text>
          {pay.data?.latest ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Muted>Latest run · {pay.data.latest.period}</Muted>
                <Muted>Net {money(pay.data.latest.net)}</Muted>
              </View>
              <Badge label={pay.data.latest.status} />
            </View>
          ) : (
            <Muted>{pay.isLoading ? 'Loading…' : 'No payroll runs yet.'}</Muted>
          )}
          {pay.data?.awaiting ? <Muted>{pay.data.awaiting} run(s) awaiting approval</Muted> : null}
        </Card>
      ) : null}

      <Card style={{ paddingVertical: 0, gap: 0 }}>
        <MenuRow icon="id-card-outline" label="Employees" onPress={() => go('/admin/employees')} />
        <MenuRow icon="calendar-number-outline" label="Employee attendance" onPress={() => go('/admin/attendance')} />
        <MenuRow icon="chatbubbles-outline" label="Grievances" onPress={() => go('/admin/grievances')} />
        {hasModule('payroll') ? (
          <MenuRow icon="wallet-outline" label="Payroll runs" onPress={() => go('/admin/payroll-runs')} />
        ) : null}
        <MenuRow icon="layers-outline" label="Masters" onPress={() => go('/admin/masters')} />
        <MenuRow icon="shield-checkmark-outline" label="Roles & access" onPress={() => go('/admin/roles')} />
      </Card>
    </Page>
  );
}
