import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { deleteCompany, listCompanies, moduleLabel, optionalOf, resetCompanyAdminPassword } from '@/api/admin/companies';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, Field, Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, MenuRow, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const COMPANIES_KEY = ['admin', 'companies'];
const statusOf = (co) =>
  co.is_active === false || String(co.status ?? 'ACTIVE').toUpperCase() !== 'ACTIVE' ? 'Inactive' : 'Active';
/** The new temporary password of a Company Admin, shown once (web: issued credentials dialog). */
function IssuedCredentials({ issued, onClose }) {
  const c = useColors();
  return (
    <Modal visible={!!issued} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, gap: 10 }} onPress={() => {}}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Company admin login</Text>
          <Muted>Name: {issued?.name || '—'}</Muted>
          <Muted>Email: {issued?.email || '—'}</Muted>
          {issued?.temporaryPassword ? (
            <View style={{ gap: 4 }}>
              <Muted>Temporary password (shown only once):</Muted>
              <Text selectable style={{ color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: 1 }}>
                {issued.temporaryPassword}
              </Text>
            </View>
          ) : null}
          <Muted>
            {issued?.emailSent
              ? 'The login details were also emailed to the admin.'
              : 'The email could not be sent — share these details with the admin yourself.'}
          </Muted>
          <Muted>The admin must set a new password at next sign-in.</Muted>
          <Button title="Done" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
/** Companies (web /org/groups, Super Admin): list, create / edit, delete, reset admin password, modules. */
export default function CompaniesScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { isSuperAdmin } = useAccess();
  const [search, setSearch] = useState('');
  const [issued, setIssued] = useState(null);
  const q = useQuery({ queryKey: COMPANIES_KEY, queryFn: listCompanies, enabled: isSuperAdmin });
  const refresh = () => qc.invalidateQueries({ queryKey: COMPANIES_KEY });
  const remove = useMutation({
    mutationFn: (co) => deleteCompany(co.id),
    onSuccess: (_d, co) => {
      refresh();
      Alert.alert('Company deleted', `Company "${co.name}" deleted successfully`);
    },
    onError: (err) => Alert.alert('Delete', errorMessage(err, 'Failed to delete company')),
  });
  const reset = useMutation({
    mutationFn: (co) => resetCompanyAdminPassword(co.id),
    onSuccess: (data, co) => {
      const admin = data?.company_admin ?? {};
      setIssued({
        name: admin.full_name ?? co.name,
        email: admin.email ?? '',
        temporaryPassword: data?.temporary_password,
        emailSent: Boolean(data?.email_sent),
      });
    },
    onError: (err) => Alert.alert('Reset password', errorMessage(err, 'Could not reset the admin password')),
  });
  if (!isSuperAdmin) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Header title="Companies" />
        <Muted>Only a Super Admin can manage companies.</Muted>
      </View>
    );
  }
  const confirmReset = (co) =>
    Alert.alert('Reset admin password', `Issue a new temporary password for the ${co.name} admin?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', onPress: () => reset.mutate(co) },
    ]);
  const confirmDelete = (co) =>
    Alert.alert(
      'Delete company',
      `Delete "${co.name}"? This cannot be undone. A company with employees cannot be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(co) },
      ],
    );
  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter(
    (co) => !term || `${co.name ?? ''} ${co.code ?? ''} ${co.legal_name ?? ''}`.toLowerCase().includes(term),
  );
  const action = (label, onPress, color = c.primary) => (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text style={{ color, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      <Header title="Companies" />
      <QueryList
        query={{ ...q, data: rows }}
        keyOf={(co, i) => String(co.id ?? i)}
        empty="No companies yet. Tap + to create one."
        header={
          <View style={{ gap: 8, marginBottom: 4 }}>
            <Card style={{ paddingVertical: 0 }}>
              <MenuRow
                icon="grid-outline"
                label="Company modules"
                hint="Optional modules per company"
                onPress={() => router.push('/admin/companies/modules')}
              />
            </Card>
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search companies" />
          </View>
        }
        renderItem={(co) => {
          const optional = optionalOf(co.optional_modules ?? co.enabled_modules ?? co.modules);
          const employees = co.employee_count ?? co.employees_count;
          const branches = co.branch_count ?? co.branches_count;
          return (
            <ItemCard
              title={co.name || '—'}
              badge={<Badge label={statusOf(co)} />}
              lines={[
                [co.code, co.legal_name && co.legal_name !== co.name ? co.legal_name : null, co.industry]
                  .filter(Boolean)
                  .join(' · '),
                [employees != null ? `${employees} employees` : null, branches != null ? `${branches} branches` : null, co.city]
                  .filter(Boolean)
                  .join(' · '),
                optional.length ? `Modules: ${optional.map(moduleLabel).join(', ')}` : null,
              ]}
              onPress={() => router.push(`/admin/companies/form?id=${encodeURIComponent(co.id)}`)}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 6 }}>
                {action('Edit', () => router.push(`/admin/companies/form?id=${encodeURIComponent(co.id)}`))}
                {action('Modules', () =>
                  router.push(
                    `/admin/companies/modules?id=${encodeURIComponent(co.id)}&name=${encodeURIComponent(co.name ?? '')}`,
                  ),
                )}
                {action('Reset admin password', () => confirmReset(co))}
                {action('Delete', () => confirmDelete(co), c.danger)}
              </View>
            </ItemCard>
          );
        }}
      />
      <Fab onPress={() => router.push('/admin/companies/form')} />
      <IssuedCredentials issued={issued} onClose={() => setIssued(null)} />
    </View>
  );
}
