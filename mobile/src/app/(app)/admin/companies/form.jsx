import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import {
  CORE_MODULES,
  OPTIONAL_MODULES,
  createCompany,
  getCompany,
  getCompanyModules,
  moduleLabel,
  optionalOf,
  updateCompany,
  updateCompanyModules,
} from '@/api/admin/companies';
import { uploadFile } from '@/api/admin/organisation';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
// Same option lists / rules as the web CompanyDialog (TenantStructure.jsx).
const CURRENCIES = [
  { label: 'INR (₹) - Indian Rupee', value: 'INR' },
  { label: 'USD ($) - US Dollar', value: 'USD' },
  { label: 'AED (د.إ) - UAE Dirham', value: 'AED' },
  { label: 'EUR (€) - Euro', value: 'EUR' },
];
const FISCAL = [
  { label: 'April (Standard India)', value: 'April' },
  { label: 'January (Calendar Year)', value: 'January' },
];
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const isValidHex = (v) => /^#([0-9a-f]{6})$/i.test(String(v ?? '').trim());
const isValidWorkEmailPrefix = (v) =>
  /^@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(v);
const t = (v) => String(v ?? '').trim();
function initialValues(e) {
  const saved = String(e?.work_email_prefix || '').replace(/^@/, '');
  return {
    name: e?.name || '',
    code: e?.code || '',
    legalName: e?.legal_name || e?.legalName || '',
    industry: e?.industry || 'Information Technology',
    website: e?.website || '',
    currency: e?.currency || 'INR',
    timezone: e?.timezone || 'Asia/Kolkata',
    fiscalYearStart: e?.fiscal_year_start || 'April',
    gstNo: e?.gst_no || e?.gstin || '',
    panNo: e?.pan_no || e?.pan || '',
    cinNo: e?.cin_no || e?.cin || '',
    tanNo: e?.tan_no || '',
    pfCode: e?.pf_code || '',
    esiCode: e?.esi_code || '',
    linNo: e?.lin_no || '',
    logoUrl: e?.logo_url || '',
    colorCode: e?.color_code || '',
    gstDocUrl: e?.gst_doc_url || '',
    panDocUrl: e?.pan_doc_url || '',
    cinDocUrl: e?.cin_doc_url || '',
    contactEmail: e?.contact_email || e?.email || '',
    contactPhone: e?.contact_phone || e?.phone || '',
    address: e?.address || '',
    city: e?.city || '',
    state: e?.state || '',
    pincode: e?.pincode || '',
    country: e?.country || 'India',
    adminName: '',
    adminEmail: '',
    workDomain: saved.split('.')[0] || '',
    workDomainTouched: Boolean(saved),
    workExt: saved.split('.').slice(1).join('.') || 'com',
    modules: optionalOf(e?.optional_modules ?? e?.enabled_modules ?? e?.modules),
  };
}
function Section({ title, children }) {
  const c = useColors();
  return (
    <Card style={{ gap: 14 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      {children}
    </Card>
  );
}
/** One document / logo: upload via POST /super-admin/upload (folder "companies"), like the web Documents tab. */
function UploadRow({ label, url, onUploaded, image }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: image ? 'image/*' : ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(res.assets[0], 'companies');
      onUploaded(typeof uploaded === 'string' ? uploaded : '');
    } catch (err) {
      Alert.alert('Upload', errorMessage(err, 'Could not upload the file.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      {image && url ? (
        <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 8 }} resizeMode="contain" />
      ) : null}
      {url ? (
        <Muted numberOfLines={1} style={{ fontSize: 12 }}>
          {url}
        </Muted>
      ) : (
        <Muted style={{ fontSize: 12 }}>Nothing uploaded</Muted>
      )}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Pressable onPress={pick} disabled={busy}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>{busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}</Text>
        </Pressable>
        {url ? (
          <Pressable onPress={() => onUploaded('')} disabled={busy}>
            <Text style={{ color: c.danger, fontWeight: '600' }}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
function Issued({ issued, onDone }) {
  const c = useColors();
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{issued.message}</Text>
      <Muted>Company admin: {issued.name || '—'}</Muted>
      <Muted>Email: {issued.email || '—'}</Muted>
      {issued.temporaryPassword ? (
        <View style={{ gap: 4 }}>
          <Muted>Temporary password (shown only once):</Muted>
          <Text selectable style={{ color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: 1 }}>
            {issued.temporaryPassword}
          </Text>
        </View>
      ) : null}
      <Muted>
        {issued.emailSent
          ? 'The login details were also emailed to the admin.'
          : 'The email could not be sent — share these details with the admin yourself.'}
      </Muted>
      <Muted>The admin must set a new password at first sign-in.</Muted>
      <Button title="Done" onPress={onDone} />
    </Card>
  );
}
/** Create (POST /super-admin/companies) / edit (PUT /super-admin/companies/{id} + PUT modules) — web CompanyDialog. */
export default function CompanyFormScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { isSuperAdmin } = useAccess();
  const { id } = useLocalSearchParams();
  const editing = !!id;
  const item = useQuery({
    queryKey: ['admin', 'company', id],
    // Web edits the row from the company list; use it when the single-company GET is not available.
    queryFn: async () => {
      try {
        return await getCompany(String(id));
      } catch (err) {
        const row = (qc.getQueryData(['admin', 'companies']) ?? []).find((co) => String(co.id) === String(id));
        if (row) return row;
        throw err;
      }
    },
    enabled: editing && isSuperAdmin,
  });
  const mods = useQuery({
    queryKey: ['admin', 'company-modules', id],
    queryFn: () => getCompanyModules(String(id)),
    enabled: editing && isSuperAdmin,
  });
  const [v, setV] = useState(editing ? null : initialValues(null));
  const [savedModules, setSavedModules] = useState(null);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(null);
  useEffect(() => {
    if (editing && item.data && !v) setV(initialValues(item.data));
  }, [editing, item.data, v]);
  // The company's real optional set comes from GET /companies/{id}/modules (web does the same on open).
  useEffect(() => {
    if (editing && v && mods.data && savedModules === null) {
      setSavedModules(mods.data.optional);
      setV((p) => ({ ...p, modules: mods.data.optional }));
    }
  }, [editing, v, mods.data, savedModules]);
  const done = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
    qc.invalidateQueries({ queryKey: ['admin', 'company'] });
    qc.invalidateQueries({ queryKey: ['admin', 'company-modules'] });
    qc.invalidateQueries({ queryKey: ['companies'] });
  };
  const save = useMutation({
    mutationFn: async ({ payload, modulesChanged, modules }) => {
      if (editing) {
        await updateCompany(String(id), payload);
        if (modulesChanged) await updateCompanyModules(String(id), modules);
        return null;
      }
      return createCompany(payload);
    },
    onSuccess: (data) => {
      done();
      if (!editing) {
        setIssued({
          message: data?.message || `Company "${t(v.name)}" created successfully`,
          name: data?.company_admin?.full_name ?? t(v.adminName),
          email: data?.company_admin?.email ?? t(v.adminEmail),
          temporaryPassword: data?.temporary_password,
          emailSent: Boolean(data?.email_sent),
        });
        return;
      }
      Alert.alert('Company', `Company "${t(v.name)}" updated successfully`);
      router.back();
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail;
      const lin = Array.isArray(detail) ? detail.find((d) => Array.isArray(d?.loc) && d.loc.includes('lin_no')) : null;
      setError(
        lin ? lin.msg || 'LIN Number is not valid' : errorMessage(err, `Failed to ${editing ? 'update' : 'create'} company`),
      );
    },
  });
  const title = editing ? 'Edit company' : 'New company';
  if (!isSuperAdmin) {
    return (
      <Page>
        <Header title={title} />
        <Muted>Only a Super Admin can manage companies.</Muted>
      </Page>
    );
  }
  if (issued) {
    return (
      <Page>
        <Header title="Company created" />
        <Issued issued={issued} onDone={() => router.back()} />
      </Page>
    );
  }
  if (editing && !v) {
    return (
      <Page>
        <Header title={title} />
        {item.error ? <ErrorText>{errorMessage(item.error, 'Could not load the company.')}</ErrorText> : <Loading />}
      </Page>
    );
  }
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const slug = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const workDomain = v.workDomainTouched ? v.workDomain : slug;
  const workEmailPrefix = `@${workDomain}.${v.workExt}`;
  const optionalList = mods.data?.available ?? OPTIONAL_MODULES;
  const coreList = mods.data?.core ?? CORE_MODULES;
  const allOn = optionalList.every((k) => v.modules.includes(k));
  const toggleModule = (k) =>
    set('modules', v.modules.includes(k) ? v.modules.filter((x) => x !== k) : [...v.modules, k]);
  const submit = () => {
    if (!t(v.name)) return setError('Company name is required');
    if (!t(v.code)) return setError('Company code is required');
    if (!editing) {
      if (!t(v.adminName)) return setError('Company Admin name is required');
      if (!EMAIL_REGEX.test(t(v.adminEmail))) return setError('Enter a valid Company Admin email');
    }
    if (!isValidWorkEmailPrefix(workEmailPrefix)) return setError('Work email prefix is required, e.g. @company.com');
    if (t(v.linNo).length > 50) return setError('LIN Number can be at most 50 characters');
    if (v.colorCode && !isValidHex(v.colorCode)) return setError('Colour code must be a 6-digit hex like #0F6B50');
    setError('');
    const payload = {
      name: t(v.name),
      code: t(v.code).toUpperCase(),
      legal_name: t(v.legalName) || t(v.name),
      industry: t(v.industry),
      website: t(v.website),
      contact_email: t(v.contactEmail),
      contact_phone: t(v.contactPhone),
      address: t(v.address),
      city: t(v.city),
      state: t(v.state),
      pincode: t(v.pincode),
      country: t(v.country),
      currency: v.currency,
      timezone: v.timezone,
      fiscal_year_start: v.fiscalYearStart,
      is_active: editing ? (item.data?.is_active ?? true) : true,
      gst_no: t(v.gstNo),
      pan_no: t(v.panNo),
      cin_no: t(v.cinNo),
      tan_no: t(v.tanNo),
      pf_code: t(v.pfCode),
      esi_code: t(v.esiCode),
      // Edit: always send so an emptied box clears the LIN. Create: leave it out when empty.
      ...(editing || t(v.linNo) ? { lin_no: t(v.linNo) } : {}),
      work_email_prefix: workEmailPrefix,
      logo_url: v.logoUrl,
      color_code: v.colorCode ? v.colorCode.toUpperCase() : null,
      gst_doc_url: v.gstDocUrl,
      pan_doc_url: v.panDocUrl,
      cin_doc_url: v.cinDocUrl,
      ...(editing
        ? {}
        : {
            modules: v.modules,
            admin_email: t(v.adminEmail).toLowerCase(),
            admin_name: t(v.adminName),
            admin_phone: t(v.contactPhone),
          }),
    };
    const before = savedModules ?? (editing ? initialValues(item.data).modules : []);
    const removed = before.filter((k) => !v.modules.includes(k));
    const modulesChanged = editing && (removed.length > 0 || v.modules.some((k) => !before.includes(k)));
    const run = () => save.mutate({ payload, modulesChanged, modules: v.modules });
    if (editing && removed.length) {
      Alert.alert(
        'Turn off modules',
        `Turn off ${removed.map(moduleLabel).join(', ')} for ${t(v.name)}? Its users lose access immediately; the data is kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', style: 'destructive', onPress: run },
        ],
      );
      return;
    }
    run();
  };
  const field = (key, label, extra = {}) => (
    <Field label={label} value={String(v[key] ?? '')} onChangeText={(x) => set(key, x)} {...extra} />
  );
  return (
    <Page>
      <Header title={editing ? `Edit — ${item.data?.name ?? 'company'}` : title} />
      <Section title="Basic info">
        {field('name', 'Company name *')}
        {field('code', 'Company code *', { autoCapitalize: 'characters' })}
        {field('legalName', 'Legal name')}
        {field('industry', 'Industry')}
        {field('website', 'Website', { autoCapitalize: 'none', keyboardType: 'url' })}
        <Select label="Currency" value={v.currency} options={CURRENCIES} onChange={(x) => set('currency', x)} />
        {field('timezone', 'Timezone', { autoCapitalize: 'none' })}
        <Select
          label="Fiscal year start"
          value={v.fiscalYearStart}
          options={FISCAL}
          onChange={(x) => set('fiscalYearStart', x)}
        />
        <View style={{ gap: 6 }}>
          {field('colorCode', 'Brand colour (hex)', { placeholder: '#0F6B50', autoCapitalize: 'characters' })}
          {isValidHex(v.colorCode) ? (
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: v.colorCode.trim() }} />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 2 }}>
            <Field
              label="Work email prefix *  @"
              value={workDomain}
              onChangeText={(x) => {
                set('workDomainTouched', true);
                set('workDomain', x.toLowerCase().replace(/[^a-z0-9.-]/g, ''));
              }}
              placeholder="company_name"
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="."
              value={v.workExt}
              onChangeText={(x) => set('workExt', x.toLowerCase().replace(/[^a-z.]/g, ''))}
              placeholder="com"
              autoCapitalize="none"
            />
          </View>
        </View>
        <Muted style={{ fontSize: 12 }}>
          Employee work emails will use {workEmailPrefix}. Nothing can be entered before the @.
        </Muted>
        {!editing ? (
          <>
            <Text style={{ color: c.primary, fontWeight: '700' }}>Company Admin account</Text>
            {field('adminName', 'Admin full name *')}
            {field('adminEmail', 'Admin email *', { autoCapitalize: 'none', keyboardType: 'email-address' })}
            <Muted style={{ fontSize: 12 }}>A temporary password is generated and shown once after creating.</Muted>
          </>
        ) : null}
      </Section>
      <Section title="Statutory & tax">
        {field('gstNo', 'GST number', { autoCapitalize: 'characters' })}
        {field('panNo', 'PAN number', { autoCapitalize: 'characters' })}
        {field('cinNo', 'CIN number', { autoCapitalize: 'characters' })}
        {field('tanNo', 'TAN number', { autoCapitalize: 'characters' })}
        {field('pfCode', 'PF code', { autoCapitalize: 'characters' })}
        {field('esiCode', 'ESI code', { autoCapitalize: 'characters' })}
        {field('linNo', 'LIN number', { autoCapitalize: 'characters', maxLength: 50 })}
      </Section>
      <Section title="Documents">
        <UploadRow label="Company logo" image url={v.logoUrl} onUploaded={(u) => set('logoUrl', u)} />
        <UploadRow label="GST certificate" url={v.gstDocUrl} onUploaded={(u) => set('gstDocUrl', u)} />
        <UploadRow label="PAN card" url={v.panDocUrl} onUploaded={(u) => set('panDocUrl', u)} />
        <UploadRow label="CIN / incorporation" url={v.cinDocUrl} onUploaded={(u) => set('cinDocUrl', u)} />
      </Section>
      <Section title="Address & contact">
        {field('contactEmail', 'Contact email', { autoCapitalize: 'none', keyboardType: 'email-address' })}
        {field('contactPhone', 'Contact phone', { keyboardType: 'phone-pad' })}
        {field('address', 'Address', { multiline: true })}
        {field('city', 'City')}
        {field('state', 'State')}
        {field('pincode', 'PIN code', { keyboardType: 'number-pad' })}
        {field('country', 'Country')}
      </Section>
      <Section title="Modules">
        <Muted style={{ fontSize: 12 }}>Core: {coreList.map(moduleLabel).join(', ')} — always on.</Muted>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontWeight: '600' }}>Optional modules</Text>
          <Pressable onPress={() => set('modules', allOn ? [] : [...optionalList])}>
            <Text style={{ color: c.primary, fontWeight: '600' }}>{allOn ? 'Deselect all' : 'Select all'}</Text>
          </Pressable>
        </View>
        {editing && mods.isLoading ? <Loading /> : null}
        {optionalList.map((k) => {
          const on = v.modules.includes(k);
          return (
            <Pressable
              key={k}
              onPress={() => toggleModule(k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.primary : c.muted} />
              <Text style={{ color: c.text }}>{moduleLabel(k)}</Text>
            </Pressable>
          );
        })}
      </Section>
      <ErrorText>{error}</ErrorText>
      <Button title={editing ? 'Save changes' : 'Create company'} onPress={submit} loading={save.isPending} />
    </Page>
  );
}
