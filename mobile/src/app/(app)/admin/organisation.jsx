import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import {
  getOrganisation,
  organisationPayload,
  saveOrganisation,
  uploadFile,
  uploadOrgLogo,
} from '@/api/admin/organisation';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const KEY = ['admin', 'organisation'];
const fromApi = (d = {}) => ({
  name: d.name || '',
  legalName: d.legal_name || d.legalName || '',
  email: d.contact_email || d.official_email || d.email || '',
  phone: d.contact_phone || d.phone || '',
  website: d.website || '',
  logoUrl: d.logo_url || '',
  gstin: d.gst_no || d.gstin || '',
  pan: d.pan_no || d.pan || '',
  address: d.address || '',
  city: d.city || '',
  state: d.state || '',
  pincode: d.pincode || '',
  country: d.country || 'India',
});
function Stat({ label, value }) {
  const c = useColors();
  return (
    <Card style={{ flexBasis: '30%', flexGrow: 1, gap: 4 }}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>{value ?? 0}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </Card>
  );
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
/** Organisation profile & setup (web /org/organisation-setup): GET / PUT /organisation, logo upload. Super Admin. */
export default function OrganisationScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { me, isSuperAdmin } = useAccess();
  const q = useQuery({ queryKey: KEY, queryFn: getOrganisation, enabled: isSuperAdmin });
  const [v, setV] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (q.data && !v) setV(fromApi(q.data));
  }, [q.data, v]);
  const save = useMutation({
    mutationFn: (vals) => saveOrganisation(organisationPayload(vals, me)),
    onSuccess: (data) => {
      if (data && typeof data === 'object') qc.setQueryData(KEY, data);
      qc.invalidateQueries({ queryKey: KEY });
      Alert.alert('Organisation', `Organisation "${v.name.trim()}" saved successfully`);
    },
    onError: (err) => setError(errorMessage(err, 'Failed to save organisation details')),
  });
  if (!isSuperAdmin) {
    return (
      <Page>
        <Header title="Organisation" />
        <Muted>Only a Super Admin can edit the organisation profile.</Muted>
      </Page>
    );
  }
  if (!v) {
    return (
      <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
        <Header title="Organisation" />
        {q.error ? <ErrorText>{errorMessage(q.error, 'Could not load the organisation.')}</ErrorText> : <Loading />}
      </Page>
    );
  }
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const stats = q.data?.stats;
  // Web uploads the logo with POST /super-admin/upload (folder "organisation") and saves logo_url with the profile.
  // When that route is not available, POST /organisation/upload-logo stores it on the organisation directly.
  const pickLogo = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    if (file.mimeType && !String(file.mimeType).startsWith('image/')) {
      Alert.alert('Logo', 'Please upload an image file (PNG, JPG, SVG, WebP)');
      return;
    }
    setUploading(true);
    try {
      let url;
      try {
        url = await uploadFile(file, 'organisation');
      } catch (err) {
        if (![403, 404, 405].includes(err?.response?.status)) throw err;
        url = await uploadOrgLogo(file);
      }
      if (typeof url === 'string' && url) {
        set('logoUrl', url);
        Alert.alert('Logo', 'Logo uploaded. Save to keep it on the profile.');
      }
    } catch (err) {
      Alert.alert('Logo', errorMessage(err, 'Could not upload the logo.'));
    } finally {
      setUploading(false);
    }
  };
  const submit = () => {
    if (!v.name.trim()) return setError('Organisation display name is required');
    setError('');
    save.mutate(v);
  };
  const field = (key, label, extra = {}) => (
    <Field label={label} value={String(v[key] ?? '')} onChangeText={(x) => set(key, x)} {...extra} />
  );
  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Organisation" />
      <Muted>Configure your root holding organisation. Companies and branches are managed under Companies.</Muted>
      {stats ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Stat label="Active companies" value={stats.total_companies} />
          <Stat label="Branches" value={stats.total_branches} />
          <Stat label="Employees" value={stats.total_employees} />
        </View>
      ) : null}
      <Section title="Logo">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {v.logoUrl ? (
            <Image
              source={{ uri: v.logoUrl }}
              style={{ width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderColor: c.border }}
              resizeMode="contain"
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Muted style={{ fontSize: 11 }}>No logo</Muted>
            </View>
          )}
          <View style={{ gap: 10 }}>
            <Pressable onPress={pickLogo} disabled={uploading}>
              <Text style={{ color: c.primary, fontWeight: '600' }}>
                {uploading ? 'Uploading…' : v.logoUrl ? 'Replace logo' : 'Upload logo'}
              </Text>
            </Pressable>
            {v.logoUrl ? (
              <Pressable onPress={() => set('logoUrl', '')} disabled={uploading}>
                <Text style={{ color: c.danger, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Section>
      <Section title="Identity">
        {field('name', 'Organisation display name *', { placeholder: 'e.g. Seereon Group of Companies' })}
        {field('legalName', 'Legal / registered name', { placeholder: 'e.g. Seereon Global Technologies Pvt Ltd' })}
        {field('gstin', 'GSTIN (GST number)', { autoCapitalize: 'characters', placeholder: 'e.g. 27AAACS1234A1Z5' })}
        {field('pan', 'PAN number', { autoCapitalize: 'characters', placeholder: 'e.g. AAACS1234A' })}
      </Section>
      <Section title="Contact">
        {field('email', 'Official contact email', { autoCapitalize: 'none', keyboardType: 'email-address' })}
        {field('phone', 'Contact phone number', { keyboardType: 'phone-pad' })}
        {field('website', 'Website URL', { autoCapitalize: 'none', keyboardType: 'url' })}
      </Section>
      <Section title="Headquarters">
        {field('address', 'Headquarters address', { multiline: true })}
        {field('city', 'City')}
        {field('state', 'State / region')}
        {field('pincode', 'PIN code', { keyboardType: 'number-pad' })}
        {field('country', 'Country')}
      </Section>
      <ErrorText>{error}</ErrorText>
      <Button title="Save organisation" onPress={submit} loading={save.isPending} />
    </Page>
  );
}
