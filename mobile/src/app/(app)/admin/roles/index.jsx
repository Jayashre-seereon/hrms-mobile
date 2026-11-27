import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { listRoles } from '@/api/admin/roles';
import { Muted } from '@/ui/components';
import { Badge, Header, ItemCard, QueryList } from '@/ui/kit';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
/** Roles list, read-only (web: RolesHubWorkspace.jsx). Role editing stays on the web portal. */
export default function RolesScreen() {
  const router = useRouter();
  const q = useQuery({ queryKey: ['admin', 'roles'], queryFn: listRoles });
  return (
    <View style={{ flex: 1 }}>
      <Header title="Roles & access" />
      <QueryList
        query={q}
        empty="No roles found."
        header={
          <View style={{ gap: 4, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <Muted>View only — create and edit roles on the web portal.</Muted>
          </View>
        }
        renderItem={(r) => {
          const users = r.assigned_users ?? r.assignedUsers ?? r.users;
          const screens = r.screens ?? (r.permissions ? Object.keys(r.permissions).length : null);
          return (
            <ItemCard
              title={r.name ?? r.code ?? 'Role'}
              badge={<Badge label={r.status} />}
              lines={[
                [r.code, (r.built_in ?? r.builtIn) ? 'Built-in' : null].filter(Boolean).join(' · '),
                r.description,
                [
                  users != null ? `${Array.isArray(users) ? users.length : users} users` : null,
                  screens != null ? `${screens} screens` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ]}
              onPress={() => router.push(`/admin/roles/${encodeURIComponent(String(r.id))}`)}
            />
          );
        }}
      />
    </View>
  );
}
