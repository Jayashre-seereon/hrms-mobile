import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useMenuGroups } from '@/features/nav/menu';
import { CompanySwitcherRow } from '@/lib/CompanyScopeNotice';
import { Card, Screen, Title } from '@/ui/components';
import { MenuRow } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/**
 * Full menu as a page (the Menu tab normally opens the side menu instead; this screen is the fallback for
 * deep links). Same groups and gates as the side menu — see features/nav/menu.js.
 */
export default function MoreScreen() {
  const c = useColors();
  const router = useRouter();
  const groups = useMenuGroups();
  return (
    <Screen>
      <Title>Menu</Title>
      <CompanySwitcherRow />
      {groups.map((g) => (
        <Card key={g.key} style={{ paddingVertical: 0, gap: 0 }}>
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              paddingTop: 12,
            }}>
            {g.label}
          </Text>
          {g.items.map((i) => (
            <MenuRow key={i.href} icon={i.icon} label={i.label} onPress={() => router.push(i.href)} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}
