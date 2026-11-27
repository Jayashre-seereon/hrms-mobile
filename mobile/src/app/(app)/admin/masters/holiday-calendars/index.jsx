import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { deleteHolidayCalendar, listHolidayCalendars, uploadHolidayCalendars } from '@/api/admin/masters-extra';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Button, Muted } from '@/ui/components';
import { Badge, Fab, Header, ItemCard, QueryList } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const EXCEL_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
const MAX_FILE_MB = 5;
/** Holiday calendars (web: Leave master → Holiday calendars). */
export default function HolidayCalendarsScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAccess();
  const canEdit = can('attendance.edit');
  const canDelete = can('attendance.delete');
  const q = useQuery({ queryKey: ['admin', 'masters', 'holiday-calendars'], queryFn: listHolidayCalendars });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'masters', 'holiday-calendars'] });
  const remove = useMutation({
    mutationFn: (id) => deleteHolidayCalendar(id),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Delete', errorMessage(err, 'Unable to delete the holiday calendar.')),
  });
  // POST /attendance/holiday-calendars/upload — the backend reads the Excel file and creates the calendars.
  const upload = useMutation({
    mutationFn: async () => {
      const res = await DocumentPicker.getDocumentAsync({ type: EXCEL_TYPES, copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return null;
      const file = res.assets[0];
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Only Excel files (.xlsx or .xls) can be uploaded');
      if (file.size && file.size > MAX_FILE_MB * 1024 * 1024)
        throw new Error(`The file is larger than ${MAX_FILE_MB} MB`);
      return uploadHolidayCalendars({ uri: file.uri, name: file.name, mimeType: file.mimeType });
    },
    onSuccess: (calendars) => {
      if (!calendars) return;
      refresh();
      Alert.alert('Upload', `${calendars.length} holiday calendar(s) uploaded`);
    },
    onError: (err) =>
      Alert.alert(
        'Upload',
        err?.response ? errorMessage(err, 'Unable to upload the holiday calendars.') : String(err?.message ?? err),
      ),
  });
  const confirmDelete = (id, name) =>
    Alert.alert('Delete holiday calendar', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  return (
    <View style={{ flex: 1 }}>
      <Header title="Holiday calendars" />
      <QueryList
        query={q}
        empty="No holiday calendars yet."
        header={
          <View style={{ gap: 8, marginBottom: 4 }}>
            <CompanyScopeNotice />
            <Muted>Calendars are visible on Holidays for employees.</Muted>
            {canEdit ? (
              <Button
                title="Bulk upload from Excel"
                variant="outline"
                onPress={() => upload.mutate()}
                loading={upload.isPending}
              />
            ) : null}
          </View>
        }
        renderItem={(cal) => (
          <ItemCard
            title={cal.name || '—'}
            badge={<Badge label={cal.payType} tone={cal.payType === 'Paid' ? 'success' : 'muted'} />}
            lines={[
              [cal.type, String(cal.year)].filter(Boolean).join(' · '),
              `${cal.holidays.length} holiday${cal.holidays.length === 1 ? '' : 's'}`,
            ]}
            onPress={() => router.push(`/admin/masters/holiday-calendars/form?id=${encodeURIComponent(cal.id)}`)}>
            {canDelete ? (
              <Pressable
                onPress={() => confirmDelete(cal.id, cal.name)}
                style={{ alignSelf: 'flex-end', paddingTop: 4 }}>
                <Text style={{ color: c.danger, fontWeight: '600' }}>Delete</Text>
              </Pressable>
            ) : null}
          </ItemCard>
        )}
      />
      {canEdit ? <Fab onPress={() => router.push('/admin/masters/holiday-calendars/form')} /> : null}
    </View>
  );
}
