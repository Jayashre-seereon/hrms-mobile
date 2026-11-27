import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text } from 'react-native';

import { resolveApiUrl } from '@/api/documents';
import {
  applyForResignation,
  getResignation,
  getResignationReasons,
  recalledResignationId,
  rememberResignationId,
  Resignation,
} from '@/api/resignation';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, DateField, Header, Page, Select, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const LETTER_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const LETTER_MAX_BYTES = 5 * 1024 * 1024;

function ResignationStatus({ r }: { r: Resignation }) {
  const c = useColors();
  const letterUrl = resolveApiUrl(r.letter?.url);
  return (
    <>
      <Card>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{r.code || 'My resignation'}</Text>
        <Badge label={r.status} />
      </Card>
      <Card style={{ gap: 0 }}>
        <Row label="Reason" value={r.reason} />
        <Row label="Requested last day" value={r.requestedLwd ? fmtDate(r.requestedLwd) : undefined} />
        <Row label="Submitted" value={r.submittedAt ? fmtDate(r.submittedAt) : undefined} />
        <Row label="Manager" value={r.managerName} />
        <Row label="Manager approval" value={r.managerStatus} />
        <Row label="Manager remarks" value={r.managerRemarks} />
        <Row label="HR clearance" value={r.hrStatus} />
        <Row label="HR remarks" value={r.hrRemarks} />
        <Row label="Notice period" value={r.noticeDays != null ? `${r.noticeDays} days` : undefined} />
        <Row label="Notice" value={r.noticeStart ? `${fmtDate(r.noticeStart)} → ${fmtDate(r.noticeEnd)}` : undefined} />
        <Row label="Final last working day" value={r.finalLwd ? fmtDate(r.finalLwd) : undefined} />
      </Card>
      {r.note ? (
        <Card>
          <Text style={{ color: c.text, fontWeight: '600' }}>Note</Text>
          <Muted>{r.note}</Muted>
        </Card>
      ) : null}
      {letterUrl ? (
        <Pressable onPress={() => Linking.openURL(letterUrl)}>
          <Text style={{ color: c.primary }}>Open resignation letter ({r.letter?.name})</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function ApplyForm({ onDone }: { onDone: (r: Resignation) => void }) {
  const reasons = useQuery({ queryKey: ['resignation', 'reasons'], queryFn: getResignationReasons });
  const [reason, setReason] = useState('');
  const [lwd, setLwd] = useState('');
  const [note, setNote] = useState('');
  const [letter, setLetter] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [error, setError] = useState('');

  const apply = useMutation({
    mutationFn: () => applyForResignation({ reason, requestedLwd: lwd, note, letter }),
    onSuccess: async (r) => {
      if (r.id) await rememberResignationId(r.id);
      Alert.alert('Resignation', 'Your resignation has been submitted to your manager.');
      onDone(r);
    },
    onError: (e) => setError(errorMessage(e, 'Could not submit the resignation.')),
  });

  const pickLetter = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: LETTER_TYPES, copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size && a.size > LETTER_MAX_BYTES) return setError('The letter must be 5 MB or smaller.');
    setError('');
    setLetter({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf' });
  };

  const submit = () => {
    if (!reason) return setError('Select a resignation reason.');
    if (!lwd) return setError('Pick your requested last working day.');
    if (!note.trim()) return setError('Add a short resignation note.');
    setError('');
    Alert.alert('Submit resignation', 'Are you sure you want to submit your resignation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', style: 'destructive', onPress: () => apply.mutate() },
    ]);
  };

  return (
    <Card style={{ gap: 16 }}>
      <Select
        label="Reason"
        value={reason}
        onChange={setReason}
        options={(reasons.data ?? []).map((r) => ({ label: r, value: r }))}
        placeholder={reasons.isLoading ? 'Loading reasons…' : 'Select a reason'}
      />
      {reasons.error ? <ErrorText>{errorMessage(reasons.error, 'Could not load reasons.')}</ErrorText> : null}
      <DateField label="Requested last working day" value={lwd} onChange={setLwd} minimumDate={new Date(`${toISODate(new Date())}T00:00:00`)} />
      <Field label="Resignation note" value={note} onChangeText={setNote} multiline style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }} />
      <Button title={letter ? `Letter: ${letter.name}` : 'Attach resignation letter (optional)'} variant="outline" onPress={pickLetter} />
      <ErrorText>{error}</ErrorText>
      <Button title="Submit resignation" variant="danger" onPress={submit} loading={apply.isPending} />
    </Card>
  );
}

export default function ResignationScreen() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['resignation', 'mine'],
    queryFn: async () => {
      const id = await recalledResignationId();
      if (!id) return null;
      try {
        return await getResignation(id);
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });

  return (
    <Page onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Header title="Resignation" />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorText>{errorMessage(query.error, 'Could not load your resignation.')}</ErrorText>
      ) : query.data ? (
        <ResignationStatus r={query.data} />
      ) : (
        <>
          <Muted>Submitting a resignation starts the exit process. Your reporting manager reviews it first, then HR.</Muted>
          <ApplyForm onDone={(r) => qc.setQueryData(['resignation', 'mine'], r)} />
        </>
      )}
    </Page>
  );
}
