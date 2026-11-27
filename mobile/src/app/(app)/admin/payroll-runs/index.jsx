import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RUN_STATUSES, listPayrollRuns } from '@/api/admin/payroll';
import { useAccess } from '@/lib/access';
import { Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, QueryList, Select } from '@/ui/kit';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { useColors } from '@/ui/theme';

const money = (v) =>
  v == null || v === '' || Number.isNaN(Number(v)) ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
const RUN_TONE = {
  Draft: 'muted',
  'Checks Failed': 'danger',
  'Checks Passed': 'success',
  'Pending Approval': 'warning',
  Approved: 'primary',
  Processed: 'primary',
  Paid: 'success',
  Rejected: 'danger',
};

/** Shortcuts to the other payroll screens (adjustments, policy, salary components / preview). */
function PayrollLinks() {
  const c = useColors();
  const router = useRouter();
  const { can } = useAccess();
  const links = [
    { label: 'Adjustments', href: '/admin/payroll/adjustments', show: can('payroll.view') },
    { label: 'Policy', href: '/admin/payroll/policy', show: can('payroll.view') },
    { label: 'Salary components', href: '/admin/payroll/salary-components', show: can('payroll.view') },
    { label: 'Salary preview', href: '/admin/payroll/salary-preview', show: can('payroll.view') },
  ].filter((l) => l.show);
  if (!links.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {links.map((l) => (
        <Pressable
          key={l.href}
          onPress={() => router.push(l.href)}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Payroll runs list (web: PayrollRunsTab.jsx). Tap a run for checks, approvals, processing and payment. */
export default function PayrollRunsScreen() {
  const router = useRouter();
  const { can } = useAccess();
  const [status, setStatus] = useState('all');
  const q = useQuery({
    queryKey: ['admin', 'payroll-runs', status],
    queryFn: () => listPayrollRuns({ status }),
  });
  return (
    <View style={{ flex: 1 }}>
      <Header title="Payroll runs" />
      <QueryList
        query={q}
        empty={`No payroll runs yet.${can('payroll.run') ? ' Lock the month’s attendance, then create one with +.' : ''}`}
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <PayrollLinks />
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ label: 'All statuses', value: 'all' }, ...RUN_STATUSES.map((s) => ({ label: s, value: s }))]}
            />
            <Muted>Tap a run to check, approve, process or pay it.</Muted>
          </View>
        }
        renderItem={(r) => (
          <ItemCard
            title={r.title || String(r.period ?? 'Payroll run')}
            badge={<Badge label={r.status} tone={RUN_TONE[r.status]} />}
            lines={[
              r.pay_date ? `Pay date ${r.pay_date}` : null,
              [
                (r.employees ?? r.totals?.employees) != null ? `${r.employees ?? r.totals.employees} employees` : null,
                (r.gross ?? r.totals?.gross) != null ? `Gross ${money(r.gross ?? r.totals?.gross)}` : null,
                (r.net ?? r.totals?.net) != null ? `Net ${money(r.net ?? r.totals?.net)}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
              r.prepared_by?.name ? `Prepared by ${r.prepared_by.name}` : null,
            ]}
            onPress={() => router.push(`/admin/payroll-runs/${encodeURIComponent(String(r.id))}`)}
          />
        )}
      />
      {can('payroll.run') ? <Fab onPress={() => router.push('/admin/payroll/new-run')} /> : null}
    </View>
  );
}
