/**
 * "Form XIII" download — web: EmployeesView downloadFormXiii (POST /employees/form-xiii?employee_id=…&output=pdf).
 * Native: saves the PDF to the cache and opens the share sheet. Web: downloads the file.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';

import { personName } from '@/api/admin/common';
import { downloadAndShareFormXiii } from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { useColors } from '@/ui/theme';

export function useFormXiiiDownload() {
  const [busyId, setBusyId] = useState(null);
  const download = async (employee) => {
    if (!employee?.id) {
      Alert.alert('Form XIII', 'Employee ID is missing; Form XIII cannot be downloaded.');
      return;
    }
    setBusyId(employee.id);
    try {
      await downloadAndShareFormXiii(String(employee.id), employee.employee_code || employee.id);
    } catch (e) {
      Alert.alert('Form XIII', errorMessage(e, 'Could not download Form XIII.'));
    } finally {
      setBusyId(null);
    }
  };
  return { busyId, download };
}

/** Compact "Form XIII" link with a download icon. */
export default function FormXiiiButton({ employee, label = 'Form XIII' }) {
  const c = useColors();
  const { busyId, download } = useFormXiiiDownload();
  const busy = busyId != null && busyId === employee?.id;
  return (
    <Pressable
      onPress={() => download(employee)}
      disabled={busy}
      hitSlop={8}
      accessibilityLabel={`Download Form XIII for ${personName(employee) || 'employee'}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: 4,
        opacity: pressed || busy ? 0.6 : 1,
      })}>
      {busy ? (
        <ActivityIndicator size="small" color={c.primary} />
      ) : (
        <Ionicons name="download-outline" size={18} color={c.primary} />
      )}
      <Text style={{ color: c.primary, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
