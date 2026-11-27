import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { getPerformanceIndicators } from '@/api/performance';
import { Muted } from '@/ui/components';
import { Badge, Header, ItemCard, QueryList } from '@/ui/kit';
export default function PerformanceScreen() {
  const query = useQuery({ queryKey: ['performance', 'indicators'], queryFn: getPerformanceIndicators });
  return (
    <View style={{ flex: 1 }}>
      <Header title="Performance indicators" />
      <QueryList
        query={query}
        empty="No performance indicators have been set up yet."
        header={<Muted>The KPIs your performance is measured against.</Muted>}
        renderItem={(i) => (
          <ItemCard
            title={i.name}
            badge={<Badge label={i.status} />}
            lines={[
              [i.code, i.category].filter(Boolean).join(' · '),
              i.target ? `Target ${i.target}${i.unit ? ` ${i.unit}` : ''}` : null,
              i.description,
            ]}
          />
        )}
      />
    </View>
  );
}
