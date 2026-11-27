import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { deleteMasterItem, listMaster, patchMasterItem, patchMasterSub } from '@/api/admin/masters';
import { getMaster, rowId } from '@/features/masters/registry';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Field, Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Generic master list: search, tap to edit, delete link, optional active switch. */
export default function MasterListScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { key } = useLocalSearchParams();
  const m = getMaster(String(key));
  const { can } = useAccess();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'master', key],
    queryFn: () => listMaster(m.endpoint, m.listParams, m.listKeys),
    enabled: !!m && !m.href,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'master', key] });
  const deactivate = useMutation({
    mutationFn: (id) => patchMasterItem(m.endpoint, id, m.deleteFallback.body),
    onSuccess: refresh,
    onError: (err) => Alert.alert(m?.deleteFallback?.label ?? 'Update', errorMessage(err, 'Could not update.')),
  });
  const remove = useMutation({
    mutationFn: (row) => deleteMasterItem(m.endpoint, rowId(m, row)),
    onSuccess: refresh,
    onError: (err, row) => {
      const message = errorMessage(err, 'Could not delete.');
      const fb = m?.deleteFallback;
      if (fb && fb.match.test(message)) {
        Alert.alert(fb.label, fb.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: fb.label, onPress: () => deactivate.mutate(rowId(m, row)) },
        ]);
      } else {
        Alert.alert('Delete', message);
      }
    },
  });
  const toggle = useMutation({
    mutationFn: ({ row, active }) =>
      patchMasterSub(m.endpoint, rowId(m, row), m.statusToggle.suffix, { [m.statusToggle.field]: active }),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Status', errorMessage(err, 'Unable to update the status.')),
  });
  if (m?.href) return <Redirect href={m.href} />;
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
  const rows = q.data ?? [];
  const filtered = {
    ...q,
    data: rows.filter(
      (r) =>
        !term ||
        JSON.stringify([m.titleOf(r), ...(m.subtitleOf?.(r) ?? [])])
          .toLowerCase()
          .includes(term),
    ),
  };
  const confirmDelete = (row) =>
    Alert.alert(`Delete ${m.singular.toLowerCase()}`, `Delete "${m.titleOf(row)}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(row) },
    ]);
  const openForm = (row) =>
    router.push(
      row
        ? `/admin/masters/form?key=${m.key}&id=${encodeURIComponent(rowId(m, row))}`
        : `/admin/masters/form?key=${m.key}`,
    );
  return (
    <View style={{ flex: 1 }}>
      <Header title={m.title} />
      <QueryList
        query={filtered}
        keyOf={(row, i) => rowId(m, row) || String(i)}
        empty={`No ${m.title.toLowerCase()} yet.`}
        header={
          <View style={{ marginBottom: 4, gap: 8 }}>
            <CompanyScopeNotice />
            {m.listNote && rows.length ? <Muted>{m.listNote(rows)}</Muted> : null}
            <Field
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${m.title.toLowerCase()}`}
            />
          </View>
        }
        renderItem={(row) => (
          <ItemCard
            title={m.titleOf(row) || '—'}
            badge={<Badge label={m.statusOf?.(row)} />}
            lines={m.subtitleOf?.(row) ?? []}
            onPress={canEdit ? () => openForm(row) : undefined}>
            {(m.statusToggle && canEdit) || canDelete ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                {m.statusToggle && canEdit ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={m.statusToggle.isActive(row)}
                      onValueChange={(active) => toggle.mutate({ row, active })}
                      disabled={toggle.isPending}
                    />
                    <Muted>Active</Muted>
                  </View>
                ) : (
                  <View />
                )}
                {canDelete ? (
                  <Pressable onPress={() => confirmDelete(row)}>
                    <Text style={{ color: c.danger, fontWeight: '600' }}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ItemCard>
        )}
      />
      {canEdit ? <Fab onPress={() => openForm()} /> : null}
    </View>
  );
}
