import { useQuery } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';
import { View } from 'react-native';

import { listPayrollRuns } from '@/api/admin/payroll';
import { Muted } from '@/ui/components';
import { Badge, Header, ItemCard, QueryList } from '@/ui/kit';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';

const money = (v: unknown) =>
  v == null || v === '' || Number.isNaN(Number(v)) ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;

/** Payroll runs list (web: PayrollRunsTab.jsx). Creating / processing runs stays on the web portal. */
export default function PayrollRunsScreen() {
  const router = useRouter();
    const q = useQuery({ queryKey: ['admin', 'payroll-runs'], queryFn: () => listPayrollRuns() });

  return (
    <View style={{ flex: 1 }}>
      <Header title="Payroll runs" />
      <QueryList
        query={q}
        empty="No payroll runs yet."
        header={
          <View style={{ gap: 4, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <Muted>Create, check and process runs on the web portal. Approvers can approve here.</Muted>
          </View>
        }
        renderItem={(r: any) => (
          <ItemCard
            title={r.title || String(r.period ?? 'Payroll run')}
            badge={<Badge label={r.status} />}
            lines={[
              r.title ? String(r.period ?? '') : null,
              [
                r.totals?.employees != null ? `${r.totals.employees} employees` : null,
                r.totals?.net != null || r.net != null ? `Net ${money(r.totals?.net ?? r.net)}` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            ]}
            onPress={() => router.push(`/admin/payroll-runs/${encodeURIComponent(String(r.id))}` as Href)}
          />
        )}
      />
    </View>
  );
}
