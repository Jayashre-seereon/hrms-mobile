import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, Text, View } from 'react-native';
import { appealGrievance, closeGrievance, getMyGrievanceDetail, withdrawGrievance } from '@/api/complaints';
import { resolveApiUrl } from '@/api/documents';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
export default function ComplaintDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['complaints', 'detail', id], queryFn: () => getMyGrievanceDetail(String(id)) });
  const [dialog, setDialog] = useState(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [dialogError, setDialogError] = useState('');
  const done = (message) => {
    qc.invalidateQueries({ queryKey: ['complaints'] });
    setDialog(null);
    setText('');
    Alert.alert('Complaint', message);
  };
  const withdraw = useMutation({
    mutationFn: () => withdrawGrievance(String(id)),
    onSuccess: () => done('Grievance withdrawn.'),
    onError: (e) => Alert.alert('Complaint', errorMessage(e)),
  });
  const close = useMutation({
    mutationFn: () => closeGrievance(String(id), { rating, feedback: text }),
    onSuccess: () => done('Thank you. The grievance is closed.'),
    onError: (e) => setDialogError(errorMessage(e)),
  });
  const appeal = useMutation({
    mutationFn: () => appealGrievance(String(id), text),
    onSuccess: () => done('Appeal sent to the CHRO.'),
    onError: (e) => setDialogError(errorMessage(e)),
  });
  const g = detail.data;
  if (detail.isLoading) return <Loading />;
  if (detail.error || !g)
    return (
      <Page>
        <Header title="Complaint" />
        <ErrorText>{errorMessage(detail.error, 'Could not load the complaint.')}</ErrorText>
      </Page>
    );
  const history = Array.isArray(g.history) ? g.history : [];
  const notes = Array.isArray(g.investigation) ? g.investigation.filter((n) => n?.visibleToEmployee !== false) : [];
  const attachments = Array.isArray(g.attachments) ? g.attachments : [];
  return (
    <Page onRefresh={() => detail.refetch()} refreshing={detail.isRefetching}>
      <Header title={String(g.code || g.id || 'Complaint')} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{g.subject}</Text>
          <Badge label={g.status} />
        </View>
        <Muted>{g.description}</Muted>
      </Card>

      <Card style={{ gap: 0 }}>
        <Row label="Category" value={g.category} />
        <Row label="Severity" value={g.severity} />
        <Row label="Against" value={g.against} />
        <Row label="Anonymous" value={(g.anonymous ?? g.is_anonymous) ? 'Yes' : 'No'} />
        <Row label="Raised on" value={g.raisedOn ? fmtDate(g.raisedOn) : undefined} />
        <Row label="Committee" value={[g.committee, g.owner].filter(Boolean).join(' · ')} />
        <Row
          label="Ack due / resolve due"
          value={g.ackDue || g.resolveDue ? `${g.ackDue ?? '—'} / ${g.resolveDue ?? '—'}` : undefined}
        />
      </Card>

      {g.resolution ? (
        <Card>
          <Text style={{ color: c.text, fontWeight: '600' }}>Resolution</Text>
          <Muted>{typeof g.resolution === 'string' ? g.resolution : JSON.stringify(g.resolution)}</Muted>
        </Card>
      ) : null}

      {attachments.length ? (
        <Card>
          <Text style={{ color: c.text, fontWeight: '600' }}>Attachments</Text>
          {attachments.map((a, i) => {
            const name = typeof a === 'string' ? a : (a?.name ?? a?.file_name ?? `File ${i + 1}`);
            const url = resolveApiUrl(
              typeof a === 'string' ? (/^https?:|^\//.test(a) ? a : '') : (a?.url ?? a?.file_url),
            );
            return url ? (
              <Pressable key={i} onPress={() => Linking.openURL(url)}>
                <Text style={{ color: c.primary }}>{name}</Text>
              </Pressable>
            ) : (
              <Muted key={i}>{name}</Muted>
            );
          })}
        </Card>
      ) : null}

      {notes.length ? (
        <Card>
          <Text style={{ color: c.text, fontWeight: '600' }}>Updates from HR</Text>
          {notes.map((n, i) => (
            <Muted key={i}>
              {[n.at || n.date ? fmtDate(n.at || n.date) : null, n.note || n.text].filter(Boolean).join(' — ')}
            </Muted>
          ))}
        </Card>
      ) : null}

      {history.length ? (
        <Card>
          <Text style={{ color: c.text, fontWeight: '600' }}>History</Text>
          {history.map((h, i) => (
            <Muted key={i}>
              {[
                h.at || h.date ? fmtDate(h.at || h.date) : null,
                h.action || h.status || h.event,
                h.by || h.actor,
                h.note,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Muted>
          ))}
        </Card>
      ) : null}

      {['Submitted', 'Acknowledged'].includes(g.status) ? (
        <Button
          title="Withdraw complaint"
          variant="danger"
          loading={withdraw.isPending}
          onPress={() =>
            Alert.alert('Withdraw', 'Withdraw this complaint?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Withdraw', style: 'destructive', onPress: () => withdraw.mutate() },
            ])
          }
        />
      ) : null}

      {g.status === 'Resolved' ? (
        <View style={{ gap: 10 }}>
          <Button
            title="Accept resolution & close"
            onPress={() => {
              setDialogError('');
              setDialog('close');
            }}
          />
          <Button
            title="Appeal to CHRO"
            variant="outline"
            onPress={() => {
              setDialogError('');
              setDialog('appeal');
            }}
          />
        </View>
      ) : null}

      <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 14 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
              {dialog === 'close' ? 'Close complaint' : 'Appeal resolution'}
            </Text>
            {dialog === 'close' ? (
              <>
                <Muted>How satisfied are you with the resolution?</Muted>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)}>
                      <Text style={{ fontSize: 30, color: n <= rating ? c.warning : c.border }}>★</Text>
                    </Pressable>
                  ))}
                </View>
                <Field label="Feedback (optional)" value={text} onChangeText={setText} multiline />
              </>
            ) : (
              <Field label="Reason for appeal" value={text} onChangeText={setText} multiline />
            )}
            <ErrorText>{dialogError}</ErrorText>
            <Button
              title={dialog === 'close' ? 'Close complaint' : 'Send appeal'}
              loading={close.isPending || appeal.isPending}
              onPress={() => {
                if (dialog === 'appeal' && !text.trim()) return setDialogError('Enter a reason for the appeal.');
                if (dialog === 'close') close.mutate();
                else appeal.mutate();
              }}
            />
            <Button title="Cancel" variant="outline" onPress={() => setDialog(null)} />
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
