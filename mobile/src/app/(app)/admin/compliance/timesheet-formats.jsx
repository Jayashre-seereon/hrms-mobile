import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { deleteTimesheetFormat, listTimesheetFormats, setTimesheetFormatActive } from '@/api/admin/compliance';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const KEY = ['admin', 'compliance', 'timesheet-formats'];
/** Timesheet formats (web TimesheetFormatsTab): list, Active switch (PATCH), delete, tap to edit, + to create. */
export default function TimesheetFormatsScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAccess();
  const canEdit = can('attendance.edit');
  const canDelete = can('attendance.delete');
  const q = useQuery({ queryKey: KEY, queryFn: listTimesheetFormats });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const toggle = useMutation({
    mutationFn: ({ id, active }) => setTimesheetFormatActive(id, active),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Status', errorMessage(err, 'Unable to update the status.')),
  });
  const remove = useMutation({
    mutationFn: (id) => deleteTimesheetFormat(id),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Delete', errorMessage(err, 'Unable to delete the timesheet format.')),
  });
  const confirmDelete = (r) =>
    Alert.alert('Delete timesheet format', `Delete "${r.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(r.id) },
    ]);
  return (
    <View style={{ flex: 1 }}>
      <Header title="Timesheet formats" />
      <QueryList
        query={q}
        empty="No timesheet formats yet."
        header={<CompanyScopeNotice />}
        renderItem={(r) => (
          <ItemCard
            title={r.name || '—'}
            badge={<Badge label={r.active ? 'Active' : 'Inactive'} />}
            lines={[
              [r.code, r.frequency, r.department].filter(Boolean).join(' · '),
              r.fields.length ? `Fields: ${r.fields.join(', ')}` : 'No fields',
              r.description,
            ]}
            onPress={
              canEdit ? () => router.push(`/admin/compliance/timesheet-form?id=${encodeURIComponent(r.id)}`) : undefined
            }>
            {canEdit || canDelete ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                {canEdit ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch
                      value={!!r.active}
                      onValueChange={(active) => toggle.mutate({ id: r.id, active })}
                      disabled={toggle.isPending}
                    />
                    <Muted>Active</Muted>
                  </View>
                ) : (
                  <View />
                )}
                {canDelete ? (
                  <Pressable onPress={() => confirmDelete(r)} disabled={remove.isPending}>
                    <Text style={{ color: c.danger, fontWeight: '600' }}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ItemCard>
        )}
      />
      {canEdit ? <Fab onPress={() => router.push('/admin/compliance/timesheet-form')} /> : null}
    </View>
  );
}
