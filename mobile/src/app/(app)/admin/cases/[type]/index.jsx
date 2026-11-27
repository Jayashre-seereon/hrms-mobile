import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  caseDate,
  caseSummary,
  caseTypeOf,
  employeeLabel,
  getEmployeeLookup,
  listCases,
} from '@/api/admin/cases';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, Field, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const toneOf = (s = '') =>
  /effective|approved|completed|active/i.test(s)
    ? 'success'
    : /reject|withdrawn/i.test(s)
      ? 'danger'
      : /pending|scheduled|processed/i.test(s)
        ? 'warning'
        : undefined;

/** One lifecycle register: GET /cases/{type}?status=&employee_id= (status filtered server-side, search locally). */
export default function AdminCaseListScreen() {
  const c = useColors();
  const router = useRouter();
  const { type, employee_id: employeeId } = useLocalSearchParams();
  const cfg = caseTypeOf(type);
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const list = useQuery({
    queryKey: ['admin', 'cases', String(type), status, employeeId ? String(employeeId) : ''],
    queryFn: () => listCases(String(type), { status, employeeId: employeeId ? String(employeeId) : undefined }),
    enabled: !!cfg,
  });
  const lookup = useQuery({ queryKey: ['admin', 'cases', 'employee-lookup'], queryFn: getEmployeeLookup, enabled: !!cfg });

  if (!cfg)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Cases" />
        <Muted style={{ padding: 16 }}>Unknown case type.</Muted>
      </View>
    );

  const all = list.data ?? [];
  const term = search.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      !term ||
      [r.id, employeeLabel(lookup.data, r.employee_id), caseSummary(cfg.key, r), r.description]
        .some((v) => String(v ?? '').toLowerCase().includes(term)),
  );
  const statusOptions = Array.from(new Set([...cfg.statuses, ...all.map((r) => r.status).filter(Boolean)]));
  const counts = cfg.statuses.slice(0, 3).map((s) => [s, all.filter((r) => r.status === s).length]);

  return (
    <View style={{ flex: 1 }}>
      <Header title={cfg.title} />
      <QueryList
        query={{ ...list, data: rows }}
        keyOf={(r, i) => String(r.id ?? i)}
        empty={`No ${cfg.title.toLowerCase()} found.`}
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <CompanyScopeNotice />
            {status === 'all' ? (
              <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {[['Total', all.length], ...counts].map(([label, value]) => (
                  <View key={label} style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{value}</Text>
                    <Muted style={{ fontSize: 12, textAlign: 'center' }}>{label}</Muted>
                  </View>
                ))}
              </Card>
            ) : null}
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ label: 'All statuses', value: 'all' }, ...statusOptions.map((s) => ({ label: s, value: s }))]}
            />
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Employee, case ID, reason…" />
          </View>
        }
        renderItem={(r) => {
          const [dateLabel, dateValue] = caseDate(cfg.key, r);
          return (
            <ItemCard
              title={employeeLabel(lookup.data, r.employee_id)}
              badge={<Badge label={r.status} tone={toneOf(r.status)} />}
              onPress={() => router.push(`/admin/cases/${cfg.key}/${encodeURIComponent(String(r.id))}`)}
              lines={[
                caseSummary(cfg.key, r),
                [r.id, dateValue ? `${dateLabel} ${fmtDate(dateValue)}` : null].filter(Boolean).join(' · '),
              ]}
            />
          );
        }}
      />
      {canEdit ? <Fab onPress={() => router.push(`/admin/cases/${cfg.key}/new`)} /> : null}
    </View>
  );
}
