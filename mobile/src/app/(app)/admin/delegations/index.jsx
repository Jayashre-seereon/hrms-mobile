import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { listDelegations } from '@/api/admin/administration';
import { listRoles } from '@/api/admin/roles';
import { useAccess } from '@/lib/access';
import { Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList, Segments } from '@/ui/kit';
const shortId = (v) => (v ? `${String(v).slice(0, 8)}…` : '—');
/** Status from the API row: is_active plus the date range (the backend never flips is_active itself). */
function delegationStatus(d, now = Date.now()) {
  if (d.is_active === false) return 'Inactive';
  const start = new Date(d.start_date).getTime();
  const end = new Date(d.end_date).getTime();
  if (!Number.isNaN(end) && end < now) return 'Expired';
  if (!Number.isNaN(start) && start > now) return 'Scheduled';
  return 'Active';
}
const TONE = { Active: 'success', Scheduled: 'warning', Expired: 'muted', Inactive: 'muted' };
/** Role delegations I created (GET /admin/delegations — the backend has no filters; status is filtered here). */
export default function DelegationsScreen() {
  const router = useRouter();
  const { can } = useAccess();
  const canDelegate = can('roles.delegate');
  const [filter, setFilter] = useState('all');
  const list = useQuery({ queryKey: ['admin', 'delegations'], queryFn: listDelegations });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: listRoles });
  const roleName = (id) => {
    const r = (roles.data ?? []).find((x) => String(x.id) === String(id));
    return r?.name ?? r?.code ?? `Role ${shortId(id)}`;
  };
  const rows = (list.data ?? []).filter((d) => filter === 'all' || delegationStatus(d) === filter);
  return (
    <View style={{ flex: 1 }}>
      <Header title="Role delegation" />
      <QueryList
        query={{ ...list, data: rows }}
        empty={filter === 'all' ? 'You have not delegated any roles yet.' : 'No delegations with this status.'}
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Muted>Roles you have temporarily delegated to other users.</Muted>
            <Segments
              value={filter}
              onChange={setFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Active', value: 'Active' },
                { label: 'Scheduled', value: 'Scheduled' },
                { label: 'Expired', value: 'Expired' },
              ]}
            />
          </View>
        }
        renderItem={(d) => {
          const status = delegationStatus(d);
          return (
            <ItemCard
              title={roleName(d.role_id)}
              badge={<Badge label={status} tone={TONE[status]} />}
              lines={[
                `Delegate user: ${shortId(d.delegatee_user_id)}`,
                `${fmtDate(d.start_date)} → ${fmtDate(d.end_date)}`,
                d.reason,
              ]}
            />
          );
        }}
      />
      {canDelegate ? <Fab onPress={() => router.push('/admin/delegations/new')} /> : null}
    </View>
  );
}
