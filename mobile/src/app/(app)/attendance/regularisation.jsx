import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import {
  decideRegularisation,
  getMyRegularisations,
  getRegularisationQueue,
  getTodayStatus,
  withdrawRegularisation,
} from '@/api/attendance';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Muted } from '@/ui/components';
import { fmtDate, fmtTime } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, QueryList, Segments, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const QUEUE_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn', 'all'];
function statusLabel(r) {
  return r.status === 'PENDING' && r.stage ? `Pending · ${r.stage === 'HR' ? 'HR' : 'Manager'}` : r.status;
}
/** "Missed punch-outs" banner from GET /attendance/today → missed_punch_outs. */
function MissedBanner() {
  const c = useColors();
  const router = useRouter();
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus });
  const missed = today.data?.missed_punch_outs ?? [];
  const open = missed.filter((m) => !m.regularisation || m.regularisation.status !== 'PENDING');
  if (!missed.length) return null;
  return (
    <Card style={{ borderColor: c.warning, gap: 8 }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>You forgot to punch out</Text>
      <Muted>These days are not counted until regularised.</Muted>
      {missed.map((m) => (
        <View key={String(m.punch_id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.text, flex: 1 }}>
            {fmtDate(m.date)} · in {fmtTime(m.in_time)}
          </Text>
          {m.regularisation?.status === 'PENDING' ? (
            <Badge label="Pending" />
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/attendance/regularisation-new',
                  params: { punch_id: String(m.punch_id), date: m.date, in_time: m.in_time ?? '' },
                })
              }>
              <Text style={{ color: c.primary, fontWeight: '600' }}>Request</Text>
            </Pressable>
          )}
        </View>
      ))}
      {open.length === 0 ? <Muted>All missed days have a pending request.</Muted> : null}
    </Card>
  );
}
function MyRequests() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['attendance', 'regularisations', 'mine'],
    queryFn: () => getMyRegularisations(),
  });
  const withdraw = useMutation({
    mutationFn: (id) => withdrawRegularisation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
    onError: (err) => Alert.alert('Withdraw', errorMessage(err)),
  });
  return (
    <QueryList
      query={query}
      empty="No regularisation requests yet."
      header={<MissedBanner />}
      renderItem={(r) => {
        const d = r.hr_decision ?? r.manager_decision;
        return (
          <ItemCard
            title={fmtDate(r.date)}
            badge={<Badge label={statusLabel(r)} tone={r.status === 'PENDING' ? 'warning' : undefined} />}
            lines={[
              `Out ${fmtTime(r.approved_out_time || r.requested_out_time)}${r.next_day ? ' (+1 day)' : ''}`,
              r.reason,
              d ? `Decision: ${d.reason || d.status}` : null,
            ]}>
            {r.can_withdraw ? (
              <View style={{ marginTop: 6 }}>
                <Button
                  title="Withdraw"
                  variant="outline"
                  loading={withdraw.isPending && withdraw.variables === r.id}
                  onPress={() =>
                    Alert.alert('Withdraw request', 'Withdraw this regularisation request?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Withdraw', style: 'destructive', onPress: () => withdraw.mutate(r.id) },
                    ])
                  }
                />
              </View>
            ) : null}
          </ItemCard>
        );
      }}
    />
  );
}
/** Approver queue — reporting managers and HR. Hidden server-side for others (empty / 403). */
function Approvals() {
  const c = useColors();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['attendance', 'regularisations', 'queue', status],
    queryFn: () => getRegularisationQueue({ status }),
  });
  const decide = useMutation({
    mutationFn: ({ id, action, reason }) =>
      decideRegularisation(id, { action, ...(reason?.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: (res, v) => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      setRejecting(null);
      setReason('');
      Alert.alert('Regularisation', res?.message || (v.action === 'approve' ? 'Approved' : 'Rejected'));
    },
    onError: (err) => Alert.alert('Regularisation', errorMessage(err)),
  });
  return (
    <>
      <QueryList
        query={query}
        empty="No requests in this list."
        header={
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={QUEUE_STATUSES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s }))}
          />
        }
        renderItem={(r) => (
          <ItemCard
            title={`${r.employee_name ?? 'Employee'}${r.employee_code ? ` · ${r.employee_code}` : ''}`}
            badge={<Badge label={statusLabel(r)} tone={r.status === 'PENDING' ? 'warning' : undefined} />}
            lines={[
              `${fmtDate(r.date)} · in ${fmtTime(r.requested_in_time)} · out ${fmtTime(r.requested_out_time)}${r.next_day ? ' (+1 day)' : ''}`,
              r.reason,
            ]}>
            {r.can_decide ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Approve"
                    loading={
                      decide.isPending && decide.variables?.id === r.id && decide.variables?.action === 'approve'
                    }
                    onPress={() => decide.mutate({ id: r.id, action: 'approve' })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Reject" variant="danger" onPress={() => setRejecting(r)} />
                </View>
              </View>
            ) : null}
          </ItemCard>
        )}
      />
      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 12 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Reject request</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (required)"
              placeholderTextColor={c.muted}
              multiline
              style={{
                minHeight: 80,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
                padding: 12,
                color: c.text,
                textAlignVertical: 'top',
              }}
            />
            {decide.error ? <ErrorText>{errorMessage(decide.error)}</ErrorText> : null}
            <Button
              title="Reject"
              variant="danger"
              disabled={!reason.trim()}
              loading={decide.isPending}
              onPress={() => rejecting && decide.mutate({ id: rejecting.id, action: 'reject', reason })}
            />
            <Button title="Cancel" variant="outline" onPress={() => setRejecting(null)} />
          </Card>
        </View>
      </Modal>
    </>
  );
}
export default function RegularisationScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('mine');
  return (
    <View style={{ flex: 1 }}>
      <Header title="Regularisation" />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segments
          value={tab}
          onChange={setTab}
          options={[
            { label: 'My requests', value: 'mine' },
            { label: 'Approvals', value: 'queue' },
          ]}
        />
      </View>
      {tab === 'mine' ? <MyRequests /> : <Approvals />}
      {tab === 'mine' ? <Fab onPress={() => router.push('/attendance/regularisation-new')} /> : null}
    </View>
  );
}
