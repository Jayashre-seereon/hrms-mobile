import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { decideLeaveApproval, LeaveApproval, listLeaveApprovals } from '@/api/leave';
import { errorMessage } from '@/lib/api';
import { Button, ErrorText, Muted } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, ItemCard, QueryList, Segments } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type Decision = { row: LeaveApproval; action: 'approve' | 'reject' } | null;

export default function LeaveApprovalsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [decision, setDecision] = useState<Decision>(null);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  const query = useQuery({ queryKey: ['leave', 'approvals'], queryFn: () => listLeaveApprovals() });
  const all = query.data ?? [];
  const filtered = all.filter((r) => (tab === 'pending' ? r.status === 'Pending' : r.status !== 'Pending'));
  const pendingCount = all.filter((r) => r.status === 'Pending').length;
  // QueryList takes the query; give it the filtered rows.
  const view = { ...query, data: filtered } as typeof query;

  const decide = useMutation({
    mutationFn: () => decideLeaveApproval(decision!.row, decision!.action, remark),
    onSuccess: () => {
      const verb = decision?.action === 'approve' ? 'approved' : 'rejected';
      setDecision(null);
      qc.invalidateQueries({ queryKey: ['leave'] });
      Alert.alert('Leave', `Request ${verb}.`);
    },
    onError: (err) => setError(errorMessage(err, 'Could not save the decision.')),
  });

  const open = (row: LeaveApproval, action: 'approve' | 'reject') => {
    setRemark('');
    setError('');
    setDecision({ row, action });
  };

  return (
    <>
      <Header title="Leave approvals" />
      <QueryList
        query={view}
        keyOf={(r) => `${r.level}-${r.apiId ?? r.id}`}
        empty={tab === 'pending' ? 'No requests waiting for you.' : 'No decided requests yet.'}
        header={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Segments
              value={tab}
              onChange={(v) => setTab(v as 'pending' | 'history')}
              options={[
                { label: `Pending${pendingCount ? ` (${pendingCount})` : ''}`, value: 'pending' },
                { label: 'History', value: 'history' },
              ]}
            />
          </View>
        }
        renderItem={(r) => (
          <ItemCard
            title={r.employee || r.empCode || 'Employee'}
            badge={<Badge label={r.statusLabel || r.status} tone={badgeTone(r.status)} />}
            lines={[
              [r.empCode, r.designation, r.department].filter(Boolean).join(' · '),
              `${r.leaveType} · ${fmtDate(r.from)}${r.to && r.to !== r.from ? ` → ${fmtDate(r.to)}` : ''} · ${r.days} day${r.days === 1 ? '' : 's'}`,
              r.available !== null ? `Balance available: ${r.available}` : null,
              r.description ? `“${r.description}”` : null,
              r.level === 'hr' ? 'HR approval step' : null,
              r.statusNote || null,
              r.decisionReason ? `Note: ${r.decisionReason}` : null,
              r.documents.length ? `Documents: ${r.documents.join(', ')}` : null,
            ]}>
            {r.status === 'Pending' && (r.canApprove || r.canReject) ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                {r.canReject ? (
                  <View style={{ flex: 1 }}>
                    <Button title="Reject" variant="outline" onPress={() => open(r, 'reject')} />
                  </View>
                ) : null}
                {r.canApprove ? (
                  <View style={{ flex: 1 }}>
                    <Button title="Approve" onPress={() => open(r, 'approve')} />
                  </View>
                ) : null}
              </View>
            ) : r.status === 'Pending' && r.actionMessage ? (
              <Muted style={{ fontSize: 12, marginTop: 4 }}>{r.actionMessage}</Muted>
            ) : null}
          </ItemCard>
        )}
      />

      <Modal visible={decision !== null} transparent animationType="fade" onRequestClose={() => setDecision(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>
              {decision?.action === 'approve' ? 'Approve leave' : 'Reject leave'}
            </Text>
            <Muted>
              {decision
                ? `${decision.row.employee} · ${decision.row.leaveType} · ${decision.row.from} → ${decision.row.to}`
                : ''}
            </Muted>
            <TextInput
              value={remark}
              onChangeText={setRemark}
              placeholder={decision?.action === 'reject' ? 'Reason for rejection (required)' : 'Remark (optional)'}
              placeholderTextColor={c.muted}
              multiline
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />
            <ErrorText>{error}</ErrorText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="outline" onPress={() => setDecision(null)} disabled={decide.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={decision?.action === 'approve' ? 'Approve' : 'Reject'}
                  variant={decision?.action === 'approve' ? 'primary' : 'danger'}
                  onPress={() => decide.mutate()}
                  loading={decide.isPending}
                  disabled={decision?.action === 'reject' && !remark.trim()}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function badgeTone(status: string) {
  const s = status.toLowerCase();
  if (s === 'approved') return 'success' as const;
  if (s === 'rejected' || s === 'cancelled') return 'danger' as const;
  if (s === 'pending') return 'warning' as const;
  return undefined;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 16, padding: 20, gap: 12 },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
