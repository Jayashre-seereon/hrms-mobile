import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { createDelegation } from '@/api/admin/administration';
import { personName } from '@/api/admin/common';
import { getEmployeeById, getEmployees } from '@/api/admin/employees';
import { listRoles } from '@/api/admin/roles';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { DateField, Header, Page, Select, toISODate } from '@/ui/kit';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Delegate a role (POST /admin/delegations). The backend wants the delegate's USER id; GET /employees rows do not
 * carry it, so the picked employee is read with GET /employees/{id} (EmployeeResponse.user_id).
 */
export default function NewDelegationScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { can, me } = useAccess();
  const allowed = can('roles.delegate');
  const today = toISODate(new Date());
  const [empSearch, setEmpSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const employees = useQuery({
    queryKey: ['admin', 'employees', 'picker', empSearch.trim()],
    queryFn: () => getEmployees({ limit: 50, search: empSearch.trim() }),
  });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: listRoles });
  const picked = useQuery({
    queryKey: ['admin', 'employee', employeeId],
    queryFn: () => getEmployeeById(employeeId),
    enabled: Boolean(employeeId),
  });
  const delegateeUserId = picked.data?.user_id ? String(picked.data.user_id) : '';
  const myUserId = String(me?.id ?? me?.user_id ?? me?.user?.id ?? '');
  const empOptions = (employees.data?.items ?? []).map((e) => ({
    value: String(e.id),
    label: [personName(e), e.employee_code].filter(Boolean).join(' · '),
  }));
  const roleOptions = (roles.data ?? [])
    .filter((r) => UUID.test(String(r.id)) && (!r.status || String(r.status).toLowerCase() === 'active'))
    .map((r) => ({ value: String(r.id), label: r.name ?? r.code ?? String(r.id) }));
  const submit = useMutation({
    mutationFn: () =>
      createDelegation({
        delegateeUserId,
        roleId,
        // Whole days in local time: from the start of the first day to the end of the last day.
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59`).toISOString(),
        reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'delegations'] });
      Alert.alert('Role delegation', 'Role delegated successfully.');
      router.back();
    },
    onError: (e) => setError(errorMessage(e, 'Could not delegate the role.')),
  });
  const onSubmit = () => {
    if (!employeeId) return setError('Select the employee to delegate to.');
    if (picked.isLoading) return setError('Still loading the selected employee…');
    if (!delegateeUserId) return setError('This employee has no login account, so a role cannot be delegated to them.');
    if (myUserId && delegateeUserId === myUserId) return setError('You cannot delegate a role to yourself.');
    if (!roleId) return setError('Select the role to delegate.');
    if (!startDate || !endDate) return setError('Pick the start and end dates.');
    if (endDate < startDate) return setError('End date must be on or after the start date.');
    setError('');
    submit.mutate();
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="Delegate role" />
      <Page>
        {!allowed ? (
          <ErrorText>You do not have permission to delegate roles (roles.delegate).</ErrorText>
        ) : null}
        <Muted>Temporarily give another user one of the roles, for a fixed period.</Muted>
        <Card style={{ gap: 12 }}>
          <Field label="Find employee" value={empSearch} onChangeText={setEmpSearch} placeholder="Name or code" />
          <Select
            label="Delegate to"
            value={employeeId}
            options={empOptions}
            onChange={setEmployeeId}
            placeholder={employees.isLoading ? 'Loading employees…' : 'Select employee'}
          />
          {employees.error ? (
            <ErrorText>{errorMessage(employees.error, 'Could not load employees.')}</ErrorText>
          ) : null}
          {picked.error ? (
            <ErrorText>{errorMessage(picked.error, 'Could not load the selected employee.')}</ErrorText>
          ) : null}
          <Select
            label="Role"
            value={roleId}
            options={roleOptions}
            onChange={setRoleId}
            placeholder={roles.isLoading ? 'Loading roles…' : 'Select role'}
          />
          {roles.error ? <ErrorText>{errorMessage(roles.error, 'Could not load roles.')}</ErrorText> : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <DateField label="Start date" value={startDate} onChange={setStartDate} />
          <DateField
            label="End date"
            value={endDate}
            onChange={setEndDate}
            minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
          />
          <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button title="Delegate role" onPress={onSubmit} loading={submit.isPending} disabled={!allowed} />
      </Page>
    </View>
  );
}
