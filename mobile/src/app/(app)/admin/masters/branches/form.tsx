import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { createBranch, getBranch, IssuedAdmin, updateBranch } from '@/api/admin/masters-extra';
import { IssuedAdminModal } from '@/features/masters/IssuedAdminModal';
import { useBranchCompanies } from '@/features/masters/useBranchCompanies';
import { EMAIL_REGEX } from '@/features/masters/validation';
import { errorMessage } from '@/lib/api';
import { useScope } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type Form = {
  companyId: string;
  name: string;
  code: string;
  isHq: boolean;
  head: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: 'active' | 'inactive';
  adminName: string;
  adminEmail: string;
  adminPhone: string;
};

/** Create / edit a branch (web BranchDialog): /admin/masters/branches/form[?id=…] */
export default function BranchForm() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { companyId: scopeCompanyId } = useScope();
  const companies = useBranchCompanies();

  const item = useQuery({
    queryKey: ['admin', 'masters', 'branch', id],
    queryFn: () => getBranch(String(id)),
    enabled: editing,
  });

  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<IssuedAdmin | null>(null);

  // New branch: company from scope (or the only one), code like the web default BR-XXXX-1234.
  useEffect(() => {
    if (form) return;
    if (editing) {
      const b = item.data;
      if (!b) return;
      setForm({
        companyId: b.companyId,
        name: b.name,
        code: b.code,
        isHq: b.isHq,
        head: b.head,
        address: b.address,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        status: b.status === 'Active' ? 'active' : 'inactive',
        adminName: '',
        adminEmail: '',
        adminPhone: '',
      });
      return;
    }
    if (!companies.data) return;
    const preset = scopeCompanyId || (companies.data.length === 1 ? companies.data[0].id : '');
    const org = companies.data.find((co) => co.id === preset);
    setForm({
      companyId: preset,
      name: '',
      code: `BR-${(org?.code || 'HQ').slice(0, 4)}-${Date.now().toString().slice(-4)}`,
      isHq: false,
      head: '',
      address: '',
      city: org?.city || '',
      state: org?.state || 'Odisha',
      pincode: '',
      status: 'active',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
    });
  }, [form, editing, item.data, companies.data, scopeCompanyId]);

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const wantsAdmin = !editing && !!(f.adminName.trim() || f.adminEmail.trim());
      const payload = {
        company_id: f.companyId,
        name: f.name.trim(),
        code: f.code.trim().toUpperCase(),
        is_headquarters: f.isHq,
        is_head_office: f.isHq,
        branch_head: f.head.trim(),
        address: f.address.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        pincode: f.pincode.trim(),
        status: f.status.toLowerCase(),
        ...(wantsAdmin
          ? { admin_name: f.adminName.trim(), admin_email: f.adminEmail.trim().toLowerCase(), admin_phone: f.adminPhone.trim() }
          : {}),
      };
      if (editing) {
        await updateBranch(String(id), payload);
        return null;
      }
      return createBranch(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'masters', 'branches'] });
      qc.invalidateQueries({ queryKey: ['admin', 'masters', 'branch', id] });
      if (res?.temporaryPassword) setIssued(res);
      else router.back();
    },
    onError: (err) => setError(errorMessage(err, `Failed to ${editing ? 'update' : 'create'} branch`)),
  });

  const title = editing ? 'Edit branch' : 'New branch';

  if ((editing && (item.isLoading || (!form && !item.error))) || (!editing && !form)) {
    return (
      <Page>
        <Header title={title} />
        {companies.error ? <ErrorText>{errorMessage(companies.error)}</ErrorText> : <Loading />}
      </Page>
    );
  }
  if (editing && item.error) {
    return (
      <Page>
        <Header title={title} />
        <ErrorText>{errorMessage(item.error, 'Could not load the branch.')}</ErrorText>
      </Page>
    );
  }
  if (!form) return null;

  const set = (patch: Partial<Form>) => setForm((prev) => ({ ...(prev as Form), ...patch }));

  const submit = () => {
    if (!form.companyId) return setError('Select a company');
    if (!form.name.trim()) return setError('Branch name is required');
    if (!form.code.trim()) return setError('Branch code is required');
    const wantsAdmin = !editing && (form.adminName.trim() || form.adminEmail.trim());
    if (wantsAdmin && (!form.adminName.trim() || !form.adminEmail.trim()))
      return setError('Branch admin needs both a name and an email — or leave both empty');
    if (wantsAdmin && !EMAIL_REGEX.test(form.adminEmail.trim())) return setError('Enter a valid branch admin email');
    setError('');
    save.mutate(form);
  };

  return (
    <Page>
      <Header title={title} />
      <Card style={{ gap: 16 }}>
        {!editing ? (
          <Select
            label="Company *"
            value={form.companyId}
            options={(companies.data ?? []).map((co) => ({ label: co.name, value: co.id }))}
            onChange={(v) => set({ companyId: v })}
          />
        ) : null}
        <Field label="Branch name *" value={form.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Bangalore Tech Hub, Bhubaneswar HQ" />
        <Field label="Branch code *" value={form.code} onChangeText={(v) => set({ code: v.toUpperCase() })} autoCapitalize="characters" placeholder="BLR-01" />
        <Field label="Branch Head / Lead" value={form.head} onChangeText={(v) => set({ head: v })} placeholder="Manager Name" />
        <Field label="Street Address" value={form.address} onChangeText={(v) => set({ address: v })} placeholder="Electronic City Phase 1" />
        <Field label="City" value={form.city} onChangeText={(v) => set({ city: v })} placeholder="Bengaluru" />
        <Field label="State" value={form.state} onChangeText={(v) => set({ state: v })} placeholder="Karnataka" />
        <Field label="PIN Code" value={form.pincode} onChangeText={(v) => set({ pincode: v })} keyboardType="number-pad" placeholder="560100" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Headquarters</Text>
          <Switch value={form.isHq} onValueChange={(v) => set({ isHq: v })} />
        </View>
        <Select
          label="Status"
          value={form.status}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ]}
          onChange={(v) => set({ status: v as Form['status'] })}
        />
      </Card>

      {!editing ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>Branch admin (optional)</Text>
          <Muted>Creates the branch admin login with a temporary password. Leave empty to add later.</Muted>
          <Field label="Admin full name" value={form.adminName} onChangeText={(v) => set({ adminName: v })} />
          <Field label="Admin email" value={form.adminEmail} onChangeText={(v) => set({ adminEmail: v })} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Admin phone (optional)" value={form.adminPhone} onChangeText={(v) => set({ adminPhone: v })} keyboardType="phone-pad" />
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title={editing ? 'Save Branch' : 'Add Branch'} onPress={submit} loading={save.isPending} />
      <IssuedAdminModal
        issued={issued}
        onClose={() => {
          setIssued(null);
          router.back();
        }}
      />
    </Page>
  );
}
