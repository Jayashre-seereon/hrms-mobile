import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { MASTER_GROUPS, MASTERS, masterModules } from '@/features/masters/registry';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card } from '@/ui/components';
import { Header, MenuRow, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Master data menu, grouped like the web Masters screen. */
export default function MastersMenu() {
  const c = useColors();
  const router = useRouter();
  const { hasModule } = useAccess();
  const allowed = (m) => {
    const mods = masterModules(m);
    return !mods || hasModule(...mods);
  };
  return (
    <Page>
      <Header title="Masters" />
      <CompanyScopeNotice />
      {MASTER_GROUPS.map((group) => {
        const items = MASTERS.filter((m) => m.group === group && allowed(m));
        if (!items.length) return null;
        return (
          <Card key={group} style={{ paddingVertical: 0, gap: 0 }}>
            <Text
              style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', paddingTop: 12 }}>
              {group}
            </Text>
            {items.map((m) => (
              <MenuRow
                key={m.key}
                icon="layers-outline"
                label={m.title}
                hint={m.readOnly ? 'View only' : undefined}
                onPress={() => router.push(m.href ?? `/admin/masters/${m.key}`)}
              />
            ))}
          </Card>
        );
      })}
    </Page>
  );
}
