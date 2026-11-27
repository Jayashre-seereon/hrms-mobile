import { useQuery } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyBalances, listMyLeaveRequests, loadEmployeeLeaveTypes, LeaveRequest, LeaveType } from '@/api/leave';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Loading, Muted, Title } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, ItemCard } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const LOP_TYPE = 'Loss of Pay (LOP)';

type BalanceLine = { type: string; key: string; used: number; pending: number; entitled: number; available: number };

/** Same rule as the web My Leave screen: one card per leave type (LOP excluded); server balance line wins. */
function buildBalances(types: LeaveType[], live: any[], rows: LeaveRequest[]): BalanceLine[] {
  const same = (a: unknown, b: unknown) =>
    String(a ?? '').trim().toLowerCase() !== '' && String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  const isType = (v: unknown, t: LeaveType) => same(v, t.name) || same(v, t.code);
  const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return types
    .filter((t) => t.name !== LOP_TYPE && t.code !== 'LOP')
    .map((t) => {
      const line = live.find((b) => [b.type, b.leave_type, b.code, b.leave_type_code].some((v) => isType(v, t)));
      const mine = rows.filter((a) => isType(a.leaveType, t));
      const daysWith = (status: string) => mine.filter((a) => a.status === status).reduce((s, a) => s + toNum(a.days), 0);
      const used = line ? toNum(line.used) : daysWith('Approved');
      const pending = line ? toNum(line.pending) : daysWith('Pending');
      const entitled = line ? toNum(line.entitled ?? line.total) : toNum(t.leaveBalance ?? t.annual);
      const available = line && line.available != null ? toNum(line.available) : Math.max(0, entitled - used - pending);
      return { type: t.name, key: t.id, used, pending, entitled, available };
    });
}

function BalanceCard({ b }: { b: BalanceLine }) {
  const c = useColors();
  return (
    <Card style={{ width: 160, gap: 4 }}>
      <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>
        {b.type}
      </Text>
      <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>{b.available}</Text>
      <Muted style={{ fontSize: 12 }}>
        of {b.entitled} · used {b.used}
        {b.pending ? ` · ${b.pending} pending` : ''}
      </Muted>
    </Card>
  );
}

export default function LeaveTab() {
  const c = useColors();
  const router = useRouter();

  const requests = useQuery({ queryKey: ['leave', 'my-requests'], queryFn: listMyLeaveRequests });
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: loadEmployeeLeaveTypes });
  // A failing balances call must not hide the screen (web uses Promise.allSettled).
  const balances = useQuery({ queryKey: ['leave', 'balances'], queryFn: () => getMyBalances().catch(() => []) });

  const refreshing = requests.isRefetching || types.isRefetching || balances.isRefetching;
  const onRefresh = () => {
    requests.refetch();
    types.refetch();
    balances.refetch();
  };

  const lines = buildBalances(types.data ?? [], balances.data ?? [], requests.data ?? []);
  const rows = requests.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Title>My Leave</Title>

        <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>Balance</Text>
        {types.isLoading ? (
          <Loading />
        ) : types.error ? (
          <ErrorText>{errorMessage(types.error, 'Could not load leave types.')}</ErrorText>
        ) : lines.length === 0 ? (
          <Muted>No leave types have been set up yet.</Muted>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {lines.map((b) => (
              <BalanceCard key={b.key} b={b} />
            ))}
          </ScrollView>
        )}

        <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>My requests</Text>
        {requests.isLoading ? (
          <Loading />
        ) : requests.error ? (
          <ErrorText>{errorMessage(requests.error, 'Could not load your leave requests.')}</ErrorText>
        ) : rows.length === 0 ? (
          <Muted>No leave requests yet. Tap + to apply.</Muted>
        ) : (
          <View style={{ gap: 12 }}>
            {rows.map((r) => (
              <ItemCard
                key={String(r.apiId ?? r.id)}
                title={r.leaveType || 'Leave'}
                badge={<Badge label={r.status} />}
                lines={[
                  `${fmtDate(r.from)}${r.to && r.to !== r.from ? ` → ${fmtDate(r.to)}` : ''} · ${r.days} day${r.days === 1 ? '' : 's'}`,
                  r.dayPart && !/full/i.test(r.dayPart) ? r.dayPart : null,
                  r.id ? `Ref ${r.id}` : null,
                ]}
                onPress={() => router.push(`/leave/${encodeURIComponent(String(r.apiId ?? r.id))}` as Href)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <Fab onPress={() => router.push('/leave/apply' as Href)} />
    </SafeAreaView>
  );
}
