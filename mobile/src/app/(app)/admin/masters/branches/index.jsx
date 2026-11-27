import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { deleteBranch, listBranches, resetBranchAdminPassword, setBranchAdmin } from '@/api/admin/masters-extra';
import { IssuedAdminModal } from '@/features/masters/IssuedAdminModal';
import { useBranchCompanies } from '@/features/masters/useBranchCompanies';
import { EMAIL_REGEX } from '@/features/masters/validation';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, ErrorText, Field, Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, QueryList, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** Branches (web: Organisation → Companies & branches, TenantStructure.jsx). */
export default function BranchesScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { can, isAdmin } = useAccess();
  const canManage = isAdmin || can('organization.edit');
  const canDelete = isAdmin || can('organization.delete');
  const [companyId, setCompanyId] = useState('');
  const [issued, setIssued] = useState(null);
  const [adminFor, setAdminFor] = useState(null);
  const companies = useBranchCompanies();
  const q = useQuery({ queryKey: ['admin', 'masters', 'branches'], queryFn: () => listBranches() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'masters', 'branches'] });
  const companyName = (id) => companies.data?.find((co) => co.id === id)?.name ?? '';
  const filtered = { ...q, data: (q.data ?? []).filter((b) => !companyId || b.companyId === companyId) };
  const remove = useMutation({
    mutationFn: (b) => deleteBranch(b.id),
    onSuccess: (_d, b) => {
      refresh();
      Alert.alert('Branch', `Branch "${b.name}" deleted successfully`);
    },
    onError: (err) => Alert.alert('Delete', errorMessage(err, 'Failed to delete branch')),
  });
  const reset = useMutation({
    mutationFn: (b) => resetBranchAdminPassword(b.id, b.name),
    onSuccess: setIssued,
    onError: (err) => Alert.alert('Reset password', errorMessage(err, 'Could not reset the admin password')),
  });
  const actions = (b) => {
    const buttons = [];
    if (canManage) {
      buttons.push({
        text: 'Edit',
        onPress: () => router.push(`/admin/masters/branches/form?id=${encodeURIComponent(b.id)}`),
      });
      buttons.push({ text: 'Set branch admin', onPress: () => setAdminFor(b) });
      buttons.push({
        text: 'Reset admin password',
        onPress: () =>
          Alert.alert('Reset password', `Issue a new temporary password for the ${b.name} admin?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', onPress: () => reset.mutate(b) },
          ]),
      });
    }
    if (canDelete) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete branch', `Delete branch "${b.name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(b) },
          ]),
      });
    }
    buttons.push({ text: 'Close', style: 'cancel' });
    Alert.alert(b.name, [b.code, companyName(b.companyId)].filter(Boolean).join(' · '), buttons);
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="Branches" />
      <QueryList
        query={filtered}
        empty="No branches yet."
        header={
          (companies.data?.length ?? 0) > 1 ? (
            <View style={{ marginBottom: 4 }}>
              <Select
                label="Company"
                value={companyId}
                options={[
                  { label: 'All companies', value: '' },
                  ...(companies.data ?? []).map((co) => ({ label: co.name, value: co.id })),
                ]}
                onChange={setCompanyId}
              />
            </View>
          ) : undefined
        }
        renderItem={(b) => (
          <ItemCard
            title={b.name}
            badge={<Badge label={b.status} />}
            lines={[
              [b.code, b.isHq ? 'Headquarters' : null].filter(Boolean).join(' · '),
              companyName(b.companyId) || null,
              [b.city, b.state, b.pincode].filter(Boolean).join(', ') || null,
              b.head ? `Head: ${b.head}` : null,
              `${b.employeesCount} employee${b.employeesCount === 1 ? '' : 's'}`,
            ]}
            onPress={canManage || canDelete ? () => actions(b) : undefined}
          />
        )}
      />
      {canManage ? <Fab onPress={() => router.push('/admin/masters/branches/form')} /> : null}

      <SetAdminModal
        branch={adminFor}
        onClose={() => setAdminFor(null)}
        onDone={(res) => {
          setAdminFor(null);
          setIssued(res);
        }}
      />
      <IssuedAdminModal issued={issued} onClose={() => setIssued(null)} />
      {reset.isPending ? <Muted style={{ textAlign: 'center', padding: 8, color: c.muted }}>Resetting…</Muted> : null}
    </View>
  );
}
/** POST /super-admin/branches/{id}/admin — creates or replaces the Branch Admin login. */
function SetAdminModal({ branch, onClose, onDone }) {
  const c = useColors();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () =>
      setBranchAdmin(branch.id, {
        admin_name: name.trim(),
        admin_email: email.trim().toLowerCase(),
        admin_phone: phone.trim(),
      }),
    onSuccess: (res) => {
      setName('');
      setEmail('');
      setPhone('');
      onDone(res);
    },
    onError: (err) => setError(errorMessage(err, 'Could not set the branch admin')),
  });
  const submit = () => {
    if (!name.trim() || !EMAIL_REGEX.test(email.trim())) return setError("Enter the admin's name and a valid email");
    setError('');
    save.mutate();
  };
  return (
    <Modal visible={!!branch} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: c.card,
          padding: 16,
          paddingBottom: 32,
          gap: 12,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>Branch admin — {branch?.name}</Text>
        <Muted>Creates the branch admin login. If one already exists, that account is deactivated and replaced.</Muted>
        <Field label="Admin full name" value={name} onChangeText={setName} />
        <Field
          label="Admin email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field label="Admin phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <ErrorText>{error}</ErrorText>
        <Button title="Save admin" onPress={submit} loading={save.isPending} />
      </View>
    </Modal>
  );
}
