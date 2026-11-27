import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { getEmployeeById, getEmployeeDocuments } from '@/api/admin/employees';
import EmployeeForm from '@/features/employees/EmployeeForm';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { ErrorText, Loading, Muted } from '@/ui/components';
import { Header } from '@/ui/kit';

/** Edit Employee — the onboarding form pre-filled with GET /employees/{id} (web: EditEmployeeForm). */
export default function EditEmployeeScreen() {
  const { id } = useLocalSearchParams();
  const { role, isAdmin, can } = useAccess();
  const allowed = role !== 'EMPLOYEE' && (isAdmin || can('employee.edit'));

  const q = useQuery({
    queryKey: ['admin', 'employee', String(id), 'edit'],
    queryFn: () => getEmployeeById(String(id)),
    enabled: !!id && allowed,
    staleTime: 0,
    gcTime: 0,
  });
  const docs = useQuery({
    queryKey: ['admin', 'employee', String(id), 'documents', 'edit'],
    queryFn: () => getEmployeeDocuments(String(id)).catch(() => []),
    enabled: !!id && allowed,
  });

  if (!allowed) {
    return (
      <View style={{ padding: 16 }}>
        <Header title="Edit Employee" />
        <Muted>You do not have permission to edit employees.</Muted>
      </View>
    );
  }
  if (q.isLoading || docs.isLoading) {
    return (
      <View style={{ padding: 16 }}>
        <Header title="Edit Employee" />
        <Loading />
      </View>
    );
  }
  if (q.error) {
    return (
      <View style={{ padding: 16 }}>
        <Header title="Edit Employee" />
        <ErrorText>{errorMessage(q.error, 'Could not load the employee.')}</ErrorText>
      </View>
    );
  }
  const existingDocs = Object.fromEntries((docs.data ?? []).map((d) => [d.document_type, d]));
  return (
    <>
      <Header title="Edit Employee" />
      <EmployeeForm employee={{ id: String(id), ...q.data }} existingDocs={existingDocs} />
    </>
  );
}
