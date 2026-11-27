import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { isOrgUser } from '@/lib/access';
import { profileOf, useSession } from '@/store/session';
import { useSideMenu } from '@/ui/SideMenu';
import { useColors } from '@/ui/theme';
const icon =
  (name) =>
  ({ color, size }) => <Ionicons name={name} color={color} size={size} />;
export default function TabsLayout() {
  const c = useColors();
  const me = useSession((s) => s.me);
  const showMenu = useSideMenu((s) => s.show);
  // Admin / HR account with no linked employee record: like the web admin portal, no self-service
  // Attendance / Leave tabs (their APIs answer 403 "No employee profile").
  const adminOnly = isOrgUser(me) && !profileOf(me).employee_id;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attendance', tabBarIcon: icon('finger-print-outline'), href: adminOnly ? null : undefined }}
      />
      <Tabs.Screen
        name="leave"
        options={{ title: 'Leave', tabBarIcon: icon('calendar-outline'), href: adminOnly ? null : undefined }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Menu', tabBarIcon: icon('menu-outline') }}
        listeners={{
          tabPress: (e) => {
            // Like the web sidebar: the Menu tab slides the full menu in instead of switching screens.
            e.preventDefault();
            showMenu();
          },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
