import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { getMyLeaveRequest, withdrawLeaveRequest } from '@/api/leave';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

export default function LeaveDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  const q = useQuery({ queryKey: ['leave', 'request', id], queryFn: () => getMyLeaveRequest(id), enabled: Boolean(id) });
  const r = q.data;

  const withdraw = useMutation({
    mutationFn: () => withdrawLeaveRequest(r?.apiId ?? id, remark),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['leave'] });
      Alert.alert('Leave', `Leave request ${r?.id ?? ''} withdrawn.`);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      setError(
        status === 409 || status === 400
          ? errorMessage(err, 'This request has already been decided or withdrawn.')
          : errorMessage(err, 'Could not withdraw this request.'),
      );
      if (status === 409 || status === 400) qc.invalidateQueries({ queryKey: ['leave'] });
    },
  });

  return (
    <>
      <Header title={r?.id ? `Leave ${r.id}` : 'Leave request'} />
      <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <ErrorText>{errorMessage(q.error, 'Could not load this request.')}</ErrorText>
        ) : r ? (
          <>
            <Card style={{ gap: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{r.leaveType || 'Leave'}</Text>
                <Badge label={r.status} />
              </View>
              <Row label="From" value={fmtDate(r.from)} />
              <Row label="To" value={fmtDate(r.to)} />
              <Row label="Days" value={String(r.days)} />
              <Row label="Day part" value={r.dayPart} />
              <Row label="Reason" value={r.reasonCategory} />
              <Row label="Applied on" value={r.appliedOn ? fmtDate(r.appliedOn) : ''} />
              <Row label="Contact" value={r.contactDuringLeave} />
              <Row label="Location" value={r.locationDuringLeave} />
              <Row label="Handover to" value={r.handoverTo} />
            </Card>

            {r.description ? (
              <Card style={{ gap: 4 }}>
                <Muted>Description</Muted>
                <Text style={{ color: c.text, fontSize: 15 }}>{r.description}</Text>
              </Card>
            ) : null}

            {r.handoverNotes ? (
              <Card style={{ gap: 4 }}>
                <Muted>Handover notes</Muted>
                <Text style={{ color: c.text, fontSize: 15 }}>{r.handoverNotes}</Text>
              </Card>
            ) : null}

            {r.decisionReason || r.decidedBy ? (
              <Card style={{ gap: 4 }}>
                <Muted>{r.status === 'Cancelled' ? 'Withdrawal remark' : 'Decision'}</Muted>
                {r.decisionReason ? <Text style={{ color: c.text, fontSize: 15 }}>{r.decisionReason}</Text> : null}
                <Muted style={{ fontSize: 12 }}>
                  {[r.decidedBy, r.decidedOn ? fmtDate(r.decidedOn) : ''].filter(Boolean).join(' · ')}
                </Muted>
              </Card>
            ) : null}

            {r.documents.length ? (
              <Card style={{ gap: 4 }}>
                <Muted>Documents</Muted>
                {r.documents.map((d, i) => (
                  <Text key={i} style={{ color: c.text }}>
                    {d}
                  </Text>
                ))}
              </Card>
            ) : null}

            {/* Only a pending request can be withdrawn (same rule as the web). */}
            {r.status === 'Pending' ? (
              <Button
                title="Withdraw request"
                variant="danger"
                onPress={() => {
                  setRemark('');
                  setError('');
                  setOpen(true);
                }}
              />
            ) : null}
          </>
        ) : null}
      </Page>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>Withdraw leave request</Text>
            <Muted>
              {r ? `${r.leaveType} · ${r.from} → ${r.to}. The days return to your balance.` : ''}
            </Muted>
            <TextInput
              value={remark}
              onChangeText={setRemark}
              placeholder="Why are you withdrawing this leave?"
              placeholderTextColor={c.muted}
              multiline
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />
            <ErrorText>{error}</ErrorText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="outline" onPress={() => setOpen(false)} disabled={withdraw.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Withdraw"
                  variant="danger"
                  onPress={() => withdraw.mutate()}
                  loading={withdraw.isPending}
                  disabled={!remark.trim()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 16, padding: 20, gap: 12 },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
