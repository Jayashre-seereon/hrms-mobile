import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { getEmployees } from '@/api/admin/employees';
import { employeeName, listPromotions, money, PROMOTION_STATUSES } from '@/api/movements';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, Field, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const pretty = (s) => String(s ?? '').replace(/_/g, ' ');
/** HR promotions register (web: features/employees/components/PromotionsTab.jsx → GET /cases/promotions). */
export default function ManagePromotionsScreen() {
  const c = useColors();
  const router = useRouter();
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const promotions = useQuery({ queryKey: ['promotions', 'org'], queryFn: () => listPromotions() });
  const employees = useQuery({
    queryKey: ['admin', 'employees', 'promotion-picker'],
    queryFn: () => getEmployees({ limit: 100 }),
  });
  const byId = useMemo(
    () => new Map((employees.data?.items ?? []).map((e) => [String(e.id), e])),
    [employees.data],
  );
  const rows = promotions.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    const e = byId.get(String(r.employee_id));
    return (
      (status === 'all' || r.status === status) &&
      (!term ||
        [r.id, e?.employee_code, employeeName(e), r.to_designation, r.purpose].join(' ').toLowerCase().includes(term))
    );
  });
  const cards = [
    ['Total', rows.length],
    ['Sent', rows.filter((r) => r.status === 'SENT_TO_EMPLOYEE').length],
    ['Queries', rows.filter((r) => r.status === 'QUERY_RAISED').length],
    ['Effective', rows.filter((r) => r.status === 'EFFECTIVE').length],
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header title="Promotions" />
      <QueryList
        query={{ ...promotions, data: filtered }}
        empty="No promotions found."
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {cards.map(([label, value]) => (
                <View key={label} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{value}</Text>
                  <Muted style={{ fontSize: 12 }}>{label}</Muted>
                </View>
              ))}
            </Card>
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { label: 'All statuses', value: 'all' },
                ...PROMOTION_STATUSES.map((s) => ({ label: pretty(s), value: s })),
              ]}
            />
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Employee, promotion ID, designation…" />
          </View>
        }
        renderItem={(r) => {
          const e = byId.get(String(r.employee_id));
          return (
            <ItemCard
              title={`${employeeName(e)}${e?.employee_code ? ` · ${e.employee_code}` : ''}`}
              badge={<Badge label={r.status} />}
              onPress={() => router.push(`/movements/${encodeURIComponent(String(r.id))}`)}
              lines={[
                `${r.from_designation || '—'} → ${r.to_designation}`,
                [r.id, r.purpose].filter(Boolean).join(' · '),
                `${money(r.from_ctc)} → ${money(r.to_ctc)} · Effective ${r.effective_from ? fmtDate(r.effective_from) : '—'}`,
                `Response: ${pretty(r.employee_response || 'PENDING')}`,
              ]}
            />
          );
        }}
      />
      {canEdit ? <Fab onPress={() => router.push('/movements/issue')} /> : null}
    </View>
  );
}
