import { View } from 'react-native';

import EmployeeForm from '@/features/employees/EmployeeForm';
import { useAccess } from '@/lib/access';
import { Muted } from '@/ui/components';
import { Header } from '@/ui/kit';

/**
 * Add New Employee — same onboarding form and API as the web (POST /employees/form).
 * Allowed like the web's canManagePeople: not an employee, and employee.edit (admins hold it).
 */
export default function NewEmployeeScreen() {
  const { role, isAdmin, can } = useAccess();
  const allowed = role !== 'EMPLOYEE' && (isAdmin || can('employee.edit'));

  if (!allowed) {
    return (
      <View style={{ padding: 16 }}>
        <Header title="Add Employee" />
        <Muted>Employees are not authorized to create or onboard employees.</Muted>
      </View>
    );
  }
  return (
    <>
      <Header title="Add Employee" />
      <EmployeeForm />
    </>
  );
}
