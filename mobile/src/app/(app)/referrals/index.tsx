import { useQuery } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { getMyReferrals, Referral } from '@/api/referrals';
import { Card, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';

function Stat({ label, value }: { label: string; value?: number | string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{value ?? 0}</Text>
      <Muted style={{ fontSize: 12, textAlign: 'center' }}>{label}</Muted>
    </View>
  );
}

export default function ReferralsScreen() {
  const router = useRouter();
  const query = useQuery({ queryKey: ['referrals', 'mine'], queryFn: () => getMyReferrals() });
  const list = { ...query, data: query.data?.items } as any;

  const items = query.data?.items ?? [];
  const stats = query.data?.stats ?? {
    referralsMade: items.length,
    inPipeline: items.filter((r) => ['Submitted', 'Screening', 'Interviewing'].includes(r.status)).length,
    hired: items.filter((r) => r.status === 'Hired' || r.status === 'Bonus paid').length,
    totalBonusReceived: items
      .filter((r) => r.status === 'Bonus paid')
      .reduce((s, r) => s + (Number(r.bonusAmount ?? r.bonus_amount) || 0), 0),
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="My referrals" />
      <QueryList<Referral>
        query={list}
        keyOf={(r, i) => String(r.id ?? r.code ?? i)}
        empty="No referrals yet. Tap + to refer a candidate."
        header={
          <Card style={{ flexDirection: 'row' }}>
            <Stat label="Referred" value={stats.referralsMade} />
            <Stat label="In pipeline" value={stats.inPipeline} />
            <Stat label="Hired" value={stats.hired} />
            <Stat label="Bonus" value={stats.totalBonusReceived ? `₹${Number(stats.totalBonusReceived).toLocaleString('en-IN')}` : 0} />
          </Card>
        }
        renderItem={(r) => (
          <ItemCard
            title={r.candidate || r.candidate_name || r.candidateName || 'Candidate'}
            badge={<Badge label={r.status} />}
            lines={[
              r.jobTitle || r.job_title,
              r.email,
              [r.relationship, (r.experienceYears ?? r.experience_years) != null && `${r.experienceYears ?? r.experience_years} yrs`]
                .filter(Boolean)
                .join(' · '),
              (r.createdOn || r.created_on) && `Referred ${fmtDate(r.createdOn || r.created_on)}`,
            ]}
          />
        )}
      />
      <Fab onPress={() => router.push('/referrals/new' as Href)} />
    </View>
  );
}
