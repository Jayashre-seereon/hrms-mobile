import { Stack } from 'expo-router';
import { SideMenu } from '@/ui/SideMenu';
import { useColors } from '@/ui/theme';
/**
 * Signed-in area: bottom tabs + every module screen pushed on top of them.
 * Module screens set their own title with <Stack.Screen options={{ title }} /> (see ui/components → Header).
 */
export default function AppLayout() {
  const c = useColors();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* Web-style sidebar, opened from the ☰ button or the Menu tab. */}
      <SideMenu />
    </>
  );
}
