import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { getRole, listRoleAssignments } from '@/api/admin/roles';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Loading, Muted } from '@/ui/components';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Role detail: permissions per screen + users holding the role (read-only). */
export default function RoleDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams();
  const role = useQuery({ queryKey: ['admin', 'role', id], queryFn: () => getRole(String(id)), enabled: !!id });
  const assignments = useQuery({ queryKey: ['admin', 'role-assignments'], queryFn: () => listRoleAssignments() });
  const r = role.data ?? {};
  const perms =
    r.permissions && typeof r.permissions === 'object' && !Array.isArray(r.permissions) ? r.permissions : {};
  const users = (assignments.data ?? []).filter(
    (a) => String(a.role_id ?? a.role?.id ?? '') === String(id) || (r.name && a.role_name === r.name),
  );
  return (
    <Page
      onRefresh={() => {
        role.refetch();
        assignments.refetch();
      }}
      refreshing={role.isRefetching}>
      <Header title={r.name ? String(r.name) : 'Role'} />
      {role.isLoading ? (
        <Loading />
      ) : role.error ? (
        <ErrorText>{errorMessage(role.error, 'Could not load the role.')}</ErrorText>
      ) : (
        <>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', flexShrink: 1 }}>{r.name}</Text>
              <Badge label={r.status} />
            </View>
            {r.code ? <Muted>{r.code}</Muted> : null}
            {r.description ? <Text style={{ color: c.text }}>{r.description}</Text> : null}
          </Card>

          <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>Permissions</Text>
          <Card style={{ gap: 0 }}>
            {Object.keys(perms).length === 0 ? (
              <Muted style={{ paddingVertical: 10 }}>No permissions mapped.</Muted>
            ) : (
              Object.entries(perms).map(([screen, p]) => {
                const actions = ['View', 'Edit', 'Delete'].filter((a) => p?.[a] || p?.[a.toLowerCase()]);
                return (
                  <View
                    key={screen}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 10,
                      borderBottomWidth: 0.5,
                      borderBottomColor: c.border,
                    }}>
                    <Text style={{ color: c.text, flexShrink: 1 }}>{screen}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {actions.length ? (
                        actions.map((a) => <Badge key={a} label={a} tone="primary" />)
                      ) : (
                        <Muted>None</Muted>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>Assigned users</Text>
          <Card style={{ gap: 8 }}>
            {assignments.isLoading ? (
              <Loading />
            ) : assignments.error ? (
              <ErrorText>{errorMessage(assignments.error, 'Could not load users.')}</ErrorText>
            ) : users.length === 0 ? (
              <Muted>No users assigned to this role yet.</Muted>
            ) : (
              users.map((a, i) => (
                <View key={String(a.id ?? i)} style={{ gap: 2 }}>
                  <Text style={{ color: c.text, fontWeight: '500' }}>{a.employee_name ?? a.email ?? 'User'}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {[
                      a.employee_code,
                      a.email,
                      a.all_branches
                        ? 'All branches'
                        : Array.isArray(a.branch_names)
                          ? a.branch_names.join(', ')
                          : a.branch_names,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Muted>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
