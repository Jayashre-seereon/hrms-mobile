/**
 * Document Register on the employee record — web: EmployeeDetail "Documents & Assets" tab.
 * Preview re-reads GET /employees/{id}/documents every time (signed view URLs expire after ~15 min).
 * Upload / replace goes through POST /employees/{id}/documents (new types) and
 * PATCH /employees/{id}/documents (types already on file) — one multipart file field per type.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';

import {
  DOCUMENT_UPLOAD_TYPES,
  documentsFormData,
  getEmployeeDocuments,
  patchEmployeeDocuments,
  resolveApiUrl,
  uploadEmployeeDocuments,
} from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { Button, Card, Loading, Muted } from '@/ui/components';
import { useColors } from '@/ui/theme';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from './constants';

/** Same register as the web (labels + the employee-record URL field for each type). */
export const DOCUMENT_REGISTER = [
  ['aadhaar_card', 'Aadhaar Card'],
  ['pan_card', 'PAN Card'],
  ['driving_license', 'Driving License'],
  ['passport', 'Passport'],
  ['resume', 'Resume / CV'],
  ['offer_letter', 'Offer Letter'],
  ['appointment_letter', 'Appointment Letter'],
  ['educational_certificate', 'Educational Certificate'],
  ['address_proof', 'Address Proof'],
  ['passport_photo', 'Passport Photo'],
  ['e_signature', 'E-Signature'],
  ['employer_signature', 'Signature of the Employer'],
  ['passbook', 'Cancelled Cheque / Passbook'],
];
const UPLOADABLE = new Set(DOCUMENT_UPLOAD_TYPES.map(([t]) => t));

async function pickFile(label) {
  const res = await DocumentPicker.getDocumentAsync({ type: ALLOWED_FILE_TYPES, copyToCacheDirectory: true });
  if (res.canceled) return null;
  const a = res.assets?.[0];
  if (!a) return null;
  if (a.mimeType && !ALLOWED_FILE_TYPES.includes(a.mimeType)) {
    Alert.alert(label, 'Only PDF, JPG and PNG files are allowed.');
    return null;
  }
  if (a.size && a.size > MAX_FILE_SIZE) {
    Alert.alert(label, 'The file is larger than 5 MB.');
    return null;
  }
  // On web the picker returns a File object — send it as is.
  return { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size, file: a.file };
}

export default function EmployeeDocuments({ employeeId, employee = {}, documents = [], loading, canEdit }) {
  const c = useColors();
  const qc = useQueryClient();
  const [selected, setSelected] = useState({});
  const uploadedTypes = new Set(documents.map((d) => d.document_type));
  const isUploaded = (type) => !!employee[`${type}_url`] || uploadedTypes.has(type);

  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(selected);
      const fresh = Object.fromEntries(entries.filter(([t]) => !isUploaded(t)));
      const replace = Object.fromEntries(entries.filter(([t]) => isUploaded(t)));
      const build = (files) => {
        if (Platform.OS !== 'web') return documentsFormData(files);
        const fd = new FormData();
        Object.entries(files).forEach(([t, f]) => f.file && fd.append(t, f.file, f.name));
        return fd;
      };
      if (Object.keys(fresh).length) await uploadEmployeeDocuments(employeeId, build(fresh));
      if (Object.keys(replace).length) await patchEmployeeDocuments(employeeId, build(replace));
    },
    onSuccess: () => {
      setSelected({});
      qc.invalidateQueries({ queryKey: ['admin', 'employee', employeeId] });
      Alert.alert('Documents', 'Documents saved.');
    },
    onError: (e) => Alert.alert('Documents', errorMessage(e, 'Could not save the documents.')),
  });

  const preview = async (type, label) => {
    try {
      const rows = await getEmployeeDocuments(employeeId);
      const d = rows.find((x) => x.document_type === type);
      const src = resolveApiUrl(d?.view_url);
      if (!src) {
        Alert.alert(label, 'This document is not available to preview.');
        return;
      }
      if (Platform.OS === 'web') await Linking.openURL(src);
      else await WebBrowser.openBrowserAsync(src);
    } catch (e) {
      Alert.alert(label, errorMessage(e, 'Could not open the document.'));
    }
  };

  const choose = async (type, label) => {
    const f = await pickFile(label);
    if (f) setSelected((s) => ({ ...s, [type]: f }));
  };

  const count = Object.keys(selected).length;
  return (
    <>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>Document Register</Text>
      <Card style={{ gap: 0 }}>
        {loading ? <Loading /> : null}
        {DOCUMENT_REGISTER.map(([type, label]) => {
          const on = isUploaded(type);
          const pick = selected[type];
          return (
            <View
              key={type}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: c.border,
              }}>
              <Ionicons name={on ? 'document-attach' : 'document-outline'} size={20} color={on ? c.primary : c.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {pick ? `${pick.name} · selected` : on ? 'Uploaded' : 'Not uploaded'}
                </Muted>
              </View>
              {on ? (
                <Pressable onPress={() => preview(type, label)} hitSlop={8}>
                  <Text style={{ color: c.primary, fontWeight: '600' }}>Preview</Text>
                </Pressable>
              ) : null}
              {canEdit && UPLOADABLE.has(type) ? (
                pick ? (
                  <Pressable
                    onPress={() =>
                      setSelected((s) => {
                        const n = { ...s };
                        delete n[type];
                        return n;
                      })
                    }
                    hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={c.danger} />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => choose(type, label)} hitSlop={8}>
                    <Text style={{ color: c.primary, fontWeight: '600' }}>{on ? 'Replace' : 'Upload'}</Text>
                  </Pressable>
                )
              ) : null}
            </View>
          );
        })}
      </Card>
      {canEdit ? (
        <>
          <Muted style={{ fontSize: 12 }}>
            PDF, JPG, PNG · max 5 MB. Photo and signatures are changed from Edit.
          </Muted>
          {count ? (
            <Button
              title={`Save ${count} document${count === 1 ? '' : 's'}`}
              onPress={() => save.mutate()}
              loading={save.isPending}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
