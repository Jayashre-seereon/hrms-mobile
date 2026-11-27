import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { getMyGrievances } from '@/api/complaints';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList, Segments } from '@/ui/kit';
const isOpen = (g) => !['Closed', 'Withdrawn'].includes(g.status);
export default function ComplaintsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('open');
  const query = useQuery({ queryKey: ['complaints', 'mine'], queryFn: () => getMyGrievances() });
  const filtered = {
    ...query,
    data: (query.data ?? []).filter((g) => (tab === 'open' ? isOpen(g) : tab === 'closed' ? !isOpen(g) : true)),
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="My complaints" />
      <QueryList
        query={filtered}
        keyOf={(g, i) => String(g.id ?? g.code ?? i)}
        empty="No complaints. Tap + to raise one."
        header={
          <Segments
            value={tab}
            onChange={setTab}
            options={[
              { label: 'Open', value: 'open' },
              { label: 'Closed', value: 'closed' },
              { label: 'All', value: 'all' },
            ]}
          />
        }
        renderItem={(g) => (
          <ItemCard
            title={g.subject || g.category || 'Complaint'}
            badge={<Badge label={g.status} />}
            lines={[
              [g.code || g.id, g.category].filter(Boolean).join(' · '),
              [
                g.severity && `Severity ${g.severity}`,
                (g.raisedOn || g.created_at || g.createdAt) &&
                  `Raised ${fmtDate(g.raisedOn || g.created_at || g.createdAt)}`,
              ]
                .filter(Boolean)
                .join(' · '),
            ]}
            onPress={() => router.push(`/complaints/${encodeURIComponent(String(g.id ?? g.code))}`)}
          />
        )}
      />
      <Fab onPress={() => router.push('/complaints/new')} />
    </View>
  );
}
