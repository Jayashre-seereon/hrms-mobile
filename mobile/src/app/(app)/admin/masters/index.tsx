import { Href, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { MASTER_GROUPS, MASTERS } from '@/features/masters/registry';
import { useAccess } from '@/lib/access';
import { Card, Muted } from '@/ui/components';
import { Header, MenuRow, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/** Master data menu, grouped like the web Masters screen. */
export default function MastersMenu() {
  const c = useColors();
  const router = useRouter();
  const { isSuperAdmin } = useAccess();

  return (
    <Page>
      <Header title="Masters" />
      {isSuperAdmin ? <Muted>Use the web portal to pick a company.</Muted> : null}
      {MASTER_GROUPS.map((group) => {
        const items = MASTERS.filter((m) => m.group === group);
        if (!items.length) return null;
        return (
          <Card key={group} style={{ paddingVertical: 0, gap: 0 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', paddingTop: 12 }}>{group}</Text>
            {items.map((m) => (
              <MenuRow
                key={m.key}
                icon="layers-outline"
                label={m.title}
                hint={m.readOnly ? 'View only' : undefined}
                onPress={() => router.push(`/admin/masters/${m.key}` as Href)}
              />
            ))}
          </Card>
        );
      })}
      <Muted>Leave types, holiday calendars, pay grades, branches, awards and performance masters are managed on the web portal.</Muted>
    </Page>
  );
}
