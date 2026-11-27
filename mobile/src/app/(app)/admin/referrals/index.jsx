import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { getAdminReferrals, getOpenPosts, getReferralMeta, REFERRAL_STATUSES } from '@/api/referrals';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, Field, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const inr = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
/** HR referrals register (web: features/employees/components/ReferralsTab.jsx → GET /referrals). */
export default function AdminReferralsScreen() {
  const c = useColors();
  const router = useRouter();
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit') || can('recruitment.edit');
  const [status, setStatus] = useState('all');
  const [jobId, setJobId] = useState('all');
  const [search, setSearch] = useState('');
  const meta = useQuery({ queryKey: ['admin', 'referrals', 'meta'], queryFn: getReferralMeta });
  const jobs = useQuery({ queryKey: ['referrals', 'open-posts'], queryFn: getOpenPosts });
  const term = search.trim();
  const list = useQuery({
    queryKey: ['admin', 'referrals', status, jobId, term],
    queryFn: () => getAdminReferrals({ status, jobId, search: term || undefined }),
  });
  const rows = list.data?.items ?? [];
  const statuses = meta.data?.statuses?.length ? meta.data.statuses : REFERRAL_STATUSES;
  const kpis = [
    ['Referrals', rows.length],
    ['In pipeline', rows.filter((r) => ['Submitted', 'Screening', 'Interviewing'].includes(r.status)).length],
    ['Hired', rows.filter((r) => r.status === 'Hired' || r.status === 'Bonus paid').length],
    [
      'Bonus paid',
      inr(
        rows
          .filter((r) => r.status === 'Bonus paid')
          .reduce((s, r) => s + (Number(r.bonusAmount ?? r.bonus_amount) || 0), 0),
      ),
    ],
  ];
  return (
    <View style={{ flex: 1 }}>
      <Header title="Referrals" />
      <QueryList
        query={{ ...list, data: rows }}
        keyOf={(r, i) => String(r.id ?? r.code ?? i)}
        empty="No referrals found."
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {kpis.map(([label, value]) => (
                <View key={label} style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{value}</Text>
                  <Muted style={{ fontSize: 12, textAlign: 'center' }}>{label}</Muted>
                </View>
              ))}
            </Card>
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ label: 'All statuses', value: 'all' }, ...statuses.map((s) => ({ label: s, value: s }))]}
            />
            <Select
              label="Job post"
              value={jobId}
              onChange={setJobId}
              options={[
                { label: 'All job posts', value: 'all' },
                ...(jobs.data ?? []).map((j) => ({ label: j.title || String(j.id), value: String(j.id) })),
              ]}
            />
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Candidate, email, job…" />
          </View>
        }
        renderItem={(r) => {
          const eligible = r.bonusEligible !== false && r.bonus_eligible !== false;
          return (
            <ItemCard
              title={r.candidate_name || r.candidateName || r.candidate || 'Candidate'}
              badge={<Badge label={r.status} />}
              onPress={() => router.push(`/admin/referrals/${encodeURIComponent(String(r.id ?? r.code))}`)}
              lines={[
                [r.code, r.job_title || r.jobTitle].filter(Boolean).join(' · '),
                [r.email, r.phone].filter(Boolean).join(' · '),
                [
                  r.relationship,
                  eligible ? `Bonus ${inr(r.bonus_amount ?? r.bonusAmount)}` : 'No bonus',
                  (r.created_on || r.createdOn) && fmtDate(r.created_on || r.createdOn),
                ]
                  .filter(Boolean)
                  .join(' · '),
              ]}
            />
          );
        }}
      />
      {canEdit ? <Fab onPress={() => router.push('/admin/referrals/new')} /> : null}
    </View>
  );
}
