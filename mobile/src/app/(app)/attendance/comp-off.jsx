import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { getMyCompOffSummary, withdrawCompOffRedemption } from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Loading, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
function Stat({ label, value }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{value ?? 0}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}
/** Comp-off balance + redemptions (web: CompOffCard → GET /leave/compoff/me). */
export default function CompOffScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['attendance', 'comp-off'], queryFn: getMyCompOffSummary });
  const withdraw = useMutation({
    mutationFn: (id) => withdrawCompOffRedemption(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance', 'comp-off'] }),
    onError: (err) => Alert.alert('Comp-off', errorMessage(err)),
  });
  const s = query.data;
  const redemptions = (s?.redemptions ?? []).map((r) => ({
    id: r.id || r.redemption_code,
    from: r.from_date || r.fromDate,
    to: r.to_date || r.toDate,
    days: r.days || (r.half_day ? 0.5 : 1),
    status: r.status,
    reason: r.reason,
  }));
  return (
    <View style={{ flex: 1 }}>
      <Header title="Comp-off" />
      <Page onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
        <Card>
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorText>{errorMessage(query.error, 'Could not load your comp-off balance.')}</ErrorText>
          ) : (
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Earned" value={s?.earned} />
              <Stat label="Redeemed" value={s?.redeemed} />
              <Stat label="Available" value={s?.available} />
            </View>
          )}
        </Card>
        <Muted>Redemptions</Muted>
        {!query.isLoading && redemptions.length === 0 ? <Muted>No redemptions yet.</Muted> : null}
        {redemptions.map((r) => (
          <ItemCard
            key={String(r.id)}
            title={r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`}
            badge={<Badge label={r.status} tone={r.status === 'Pending Approval' ? 'warning' : undefined} />}
            lines={[`${r.days} day${r.days === 1 ? '' : 's'}`, r.reason]}>
            {r.status === 'Pending Approval' ? (
              <View style={{ marginTop: 6 }}>
                <Button
                  title="Withdraw"
                  variant="outline"
                  loading={withdraw.isPending && withdraw.variables === r.id}
                  onPress={() =>
                    Alert.alert('Withdraw', 'Withdraw this comp-off redemption?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Withdraw', style: 'destructive', onPress: () => withdraw.mutate(r.id) },
                    ])
                  }
                />
              </View>
            ) : null}
          </ItemCard>
        ))}
      </Page>
      <Fab onPress={() => router.push('/attendance/comp-off-new')} />
    </View>
  );
}
