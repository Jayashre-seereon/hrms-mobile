import { RefreshControl, Text, View } from 'react-native';
import { useState } from 'react';
import { displayName, profileOf, useSession } from '@/store/session';
import { Button, Card, Muted, Row, Screen } from '@/ui/components';
import { initials } from '@/ui/format';
import { useColors } from '@/ui/theme';
export default function ProfileScreen() {
  const c = useColors();
  const me = useSession((s) => s.me);
  const refreshMe = useSession((s) => s.refreshMe);
  const signOut = useSession((s) => s.signOut);
  const [refreshing, setRefreshing] = useState(false);
  const p = profileOf(me);
  const name = displayName(me);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMe();
    } catch {
      // keep the last loaded profile
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={{ alignItems: 'center', gap: 8, marginTop: 16 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{initials(name)}</Text>
        </View>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{name}</Text>
        <Muted>{[p.designation, p.employee_code].filter(Boolean).join(' · ')}</Muted>
      </View>

      <Card style={{ gap: 0 }}>
        <Row label="Email" value={p.email} />
        <Row label="Phone" value={p.phone} />
        <Row label="Department" value={p.department} />
        <Row label="Designation" value={p.designation} />
        <Row label="Employee ID" value={p.employee_code} />
        <Row label="Role" value={p.role} />
      </Card>

      <Button title="Sign out" variant="outline" onPress={signOut} />
    </Screen>
  );
}
