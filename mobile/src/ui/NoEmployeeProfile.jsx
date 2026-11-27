import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { errorDetail } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, Muted } from './components';
import { useColors } from './theme';

/**
 * Backend answers 403 "No employee profile found for user ..." on employee self-service
 * endpoints (attendance, leave, payslips...) when the signed-in account is an admin
 * account with no linked employee record.
 */
export function isNoEmployeeProfile(error) {
  return /no employee profile/i.test(errorDetail(error));
}

/** Shown instead of self-service cards for accounts without an employee profile. */
export function NoEmployeeProfile() {
  const c = useColors();
  const router = useRouter();
  const { isOrgUser } = useAccess();
  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '600', color: c.text }}>No employee profile</Text>
      <Muted>
        This account is not linked to an employee record, so attendance, leave and payslips are not available.
        {isOrgUser ? ' Use the admin area to manage your organisation.' : ' Ask HR to link your employee profile.'}
      </Muted>
      {isOrgUser ? <Button title="Open admin dashboard" onPress={() => router.push('/admin')} /> : null}
    </Card>
  );
}
