import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { CASE_TYPE_KEYS, CASE_TYPES } from '@/api/admin/cases';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, Muted } from '@/ui/components';
import { Header, MenuRow, Page } from '@/ui/kit';

/** Employee lifecycle cases hub — one row per /cases/* register (backend app/api/v1/cases.py). */
export default function AdminCasesHub() {
  const router = useRouter();
  const { hasModule } = useAccess();
  const enabled = hasModule('employee');
  return (
    <View style={{ flex: 1 }}>
      <Header title="Lifecycle cases" />
      <Page>
        <CompanyScopeNotice />
        {enabled ? (
          <Card style={{ paddingVertical: 0 }}>
            {CASE_TYPE_KEYS.map((k) => (
              <MenuRow
                key={k}
                icon={CASE_TYPES[k].icon}
                label={CASE_TYPES[k].title}
                hint={CASE_TYPES[k].hint}
                onPress={() => router.push(`/admin/cases/${k}`)}
              />
            ))}
          </Card>
        ) : (
          <Muted>The Employee module is not enabled for your account.</Muted>
        )}
      </Page>
    </View>
  );
}
