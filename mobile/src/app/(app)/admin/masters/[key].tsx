import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { deleteMasterItem, listMaster } from '@/api/admin/masters';
import { getMaster } from '@/features/masters/registry';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Field, Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/** Generic master list: search, tap to edit, long-press / delete link to delete. */
export default function MasterListScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { key } = useLocalSearchParams<{ key: string }>();
  const m = getMaster(String(key));
  const { can } = useAccess();
  const [search, setSearch] = useState('');

  const q = useQuery({
    queryKey: ['admin', 'master', key],
    queryFn: () => listMaster(m!.endpoint, m!.listParams),
    enabled: !!m,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMasterItem(m!.endpoint, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'master', key] }),
    onError: (err) => Alert.alert('Delete', errorMessage(err, 'Could not delete.')),
  });

  if (!m) {
    return (
      <View style={{ padding: 16 }}>
        <Header title="Masters" />
        <Muted>Unknown master.</Muted>
      </View>
    );
  }

  const canEdit = !m.readOnly && can(`${m.module}.edit`);
  const canDelete = !m.readOnly && m.canDelete && can(`${m.module}.delete`);
  const term = search.trim().toLowerCase();
  const filtered = {
    ...q,
    data: (q.data ?? []).filter((r) => !term || JSON.stringify([m.titleOf(r), ...(m.subtitleOf?.(r) ?? [])]).toLowerCase().includes(term)),
  } as typeof q;

  const confirmDelete = (row: any) =>
    Alert.alert(`Delete ${m.singular.toLowerCase()}`, `Delete "${m.titleOf(row)}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(String(row.id)) },
    ]);

  const openForm = (row?: any) =>
    router.push((row ? `/admin/masters/form?key=${m.key}&id=${encodeURIComponent(String(row.id))}` : `/admin/masters/form?key=${m.key}`) as Href);

  return (
    <View style={{ flex: 1 }}>
      <Header title={m.title} />
      <QueryList
        query={filtered}
        empty={`No ${m.title.toLowerCase()} yet.`}
        header={<View style={{ marginBottom: 4 }}><Field label="Search" value={search} onChangeText={setSearch} placeholder={`Search ${m.title.toLowerCase()}`} /></View>}
        renderItem={(row: any) => (
          <ItemCard
            title={m.titleOf(row) || '—'}
            badge={<Badge label={m.statusOf?.(row)} />}
            lines={m.subtitleOf?.(row) ?? []}
            onPress={canEdit ? () => openForm(row) : undefined}>
            {canDelete ? (
              <Pressable onPress={() => confirmDelete(row)} style={{ alignSelf: 'flex-end', paddingTop: 4 }}>
                <Text style={{ color: c.danger, fontWeight: '600' }}>Delete</Text>
              </Pressable>
            ) : null}
          </ItemCard>
        )}
      />
      {canEdit ? <Fab onPress={() => openForm()} /> : null}
    </View>
  );
}
