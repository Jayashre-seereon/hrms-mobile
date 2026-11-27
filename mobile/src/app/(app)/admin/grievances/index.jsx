import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getGrievanceStats, GRIEVANCE_STATUSES, listGrievances } from '@/api/admin/grievances';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, Field, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, ItemCard, QueryList, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const severityTone = (s) => (/high|critical/i.test(s ?? '') ? 'danger' : /medium/i.test(s ?? '') ? 'warning' : 'muted');
export default function GrievancesScreen() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [overdue, setOverdue] = useState(false);
  const stats = useQuery({ queryKey: ['admin', 'grievances', 'stats'], queryFn: getGrievanceStats });
  const list = useQuery({
    queryKey: ['admin', 'grievances', status, overdue],
    queryFn: () => listGrievances({ status, overdue }),
  });
  const term = search.trim().toLowerCase();
  const filtered = {
    ...list,
    data: (list.data ?? []).filter(
      (g) =>
        !term ||
        [g.subject, g.code, g.employee, g.display_name, g.category].some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(term),
        ),
    ),
  };
  const s = stats.data ?? {};
  return (
    <View style={{ flex: 1 }}>
      <Header title="Grievances" />
      <QueryList
        query={filtered}
        empty="No grievances."
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                ['Open', s.totalOpen],
                ['SLA breached', s.slaBreached],
                ['Appeals', s.appealsCount],
                ['CSAT', s.csatRating],
              ].map(([label, value]) => (
                <View key={String(label)} style={{ alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{value ?? '—'}</Text>
                  <Muted style={{ fontSize: 12 }}>{label}</Muted>
                </View>
              ))}
            </Card>
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ label: 'All', value: 'all' }, ...GRIEVANCE_STATUSES.map((v) => ({ label: v, value: v }))]}
            />
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Subject, code, employee" />
            <Pressable onPress={() => setOverdue((v) => !v)}>
              <Text style={{ color: overdue ? c.danger : c.muted, fontWeight: '600' }}>
                {overdue ? '☑' : '☐'} Overdue only
              </Text>
            </Pressable>
          </View>
        }
        renderItem={(g) => (
          <ItemCard
            title={g.subject || g.category || 'Grievance'}
            badge={<Badge label={g.status} />}
            lines={[
              [g.code, g.category].filter(Boolean).join(' · '),
              g.anonymous
                ? 'Anonymous'
                : [g.employee || g.display_name, g.dept || g.department].filter(Boolean).join(' · '),
              `Raised ${fmtDate(g.raisedOn ?? g.raised_on)}${g.resolveDue ? ` · Resolve by ${fmtDate(g.resolveDue)}` : ''}`,
            ]}
            onPress={() => router.push(`/admin/grievances/${encodeURIComponent(String(g.id ?? g.code))}`)}>
            {g.severity ? (
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <Badge label={g.severity} tone={severityTone(g.severity)} />
              </View>
            ) : null}
          </ItemCard>
        )}
      />
    </View>
  );
}
