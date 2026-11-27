import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { deletePattern, listPatterns } from '@/api/admin/compliance';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Badge, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Attendance patterns (web PatternsTab): GET list, tap to edit, delete, + to create. */
export default function PatternsScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAccess();
  // Web: editable = can(role, "employee.manage").
  const canEdit = can('employee.manage') || can('employee.edit');
  const q = useQuery({ queryKey: ['admin', 'compliance', 'patterns'], queryFn: listPatterns });
  const remove = useMutation({
    mutationFn: (id) => deletePattern(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'patterns'] }),
    onError: (err) => Alert.alert('Delete', errorMessage(err, 'Unable to delete attendance pattern')),
  });
  const confirmDelete = (p) =>
    Alert.alert('Delete pattern', `Delete "${p.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(p.id) },
    ]);
  return (
    <View style={{ flex: 1 }}>
      <Header title="Attendance patterns" />
      <QueryList
        query={q}
        empty="No attendance patterns yet."
        header={<CompanyScopeNotice />}
        renderItem={(p) => (
          <ItemCard
            title={p.name || '—'}
            badge={<Badge label={p.status} />}
            lines={[
              [p.code, `${p.workingDays} working days`, `${p.weeklyOffs} weekly offs`].filter(Boolean).join(' · '),
              p.lopEnabled ? 'LOP applies beyond paid days' : 'No LOP',
              p.employees ? `${p.employees} employee(s) assigned` : null,
              p.description,
            ]}
            onPress={canEdit ? () => router.push(`/admin/compliance/pattern-form?id=${encodeURIComponent(p.id)}`) : undefined}>
            {canEdit ? (
              <View style={{ alignItems: 'flex-end', paddingTop: 4 }}>
                <Pressable onPress={() => confirmDelete(p)} disabled={remove.isPending}>
                  <Text style={{ color: c.danger, fontWeight: '600' }}>Delete</Text>
                </Pressable>
              </View>
            ) : null}
          </ItemCard>
        )}
      />
      {canEdit ? <Fab onPress={() => router.push('/admin/compliance/pattern-form')} /> : null}
    </View>
  );
}
