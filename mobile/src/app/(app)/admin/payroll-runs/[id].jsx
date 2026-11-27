import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { decidePayrollRun, getPayrollRun } from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const money = (v) =>
  v == null || v === '' || Number.isNaN(Number(v)) ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
/** Reason prompt (Alert.prompt is iOS-only). */
function ReasonModal({ title, confirmLabel, visible, busy, onCancel, onConfirm }) {
  const c = useColors();
  const [text, setText] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }}
        onPress={onCancel}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 16, padding: 16, gap: 12 }} onPress={() => {}}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
          <Field label="Reason" value={text} onChangeText={setText} multiline autoFocus />
          <Button title={confirmLabel} onPress={() => onConfirm(text.trim())} loading={busy} disabled={!text.trim()} />
          <Button title="Cancel" variant="outline" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
/** Payroll run detail, read-only + approve / reject (web: PayrollRunsTab.jsx). */
export default function PayrollRunDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const { can } = useAccess();
  const [prompt, setPrompt] = useState(null);
  const q = useQuery({
    queryKey: ['admin', 'payroll-run', id],
    queryFn: () => getPayrollRun(String(id)),
    enabled: !!id,
  });
  const run = q.data ?? {};
  const t = run.totals ?? {};
  const next = run.next_action ?? {};
  const lines = Array.isArray(run.lines) ? run.lines : [];
  const decide = useMutation({
    mutationFn: ({ decision, remarks }) => decidePayrollRun(String(run.id ?? id), decision, remarks),
    onSuccess: (_d, v) => {
      setPrompt(null);
      qc.invalidateQueries({ queryKey: ['admin', 'payroll-run'] });
      qc.invalidateQueries({ queryKey: ['admin', 'payroll-runs'] });
      Alert.alert('Payroll', v.decision === 'approve' ? 'Payroll approved.' : 'Run rejected.');
    },
    onError: (err) => Alert.alert('Payroll', errorMessage(err)),
  });
  // Same rule as web: Pending Approval + payroll.approve + backend says this user can act at this level.
  const canDecide = run.status === 'Pending Approval' && can('payroll.approve') && next.can_act !== false;
  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title={run.period ? `Payroll ${run.period}` : 'Payroll run'} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorText>{errorMessage(q.error, 'Could not load the payroll run.')}</ErrorText>
      ) : (
        <>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{run.title || run.period}</Text>
              {next.label || next.message ? <Muted>{next.label || next.message}</Muted> : null}
            </View>
            <Badge label={run.status} />
          </Card>

          <Card style={{ gap: 0 }}>
            <Row
              label="Employees"
              value={t.employees != null ? String(t.employees) : lines.length ? String(lines.length) : null}
            />
            <Row label="Gross" value={money(t.gross)} />
            <Row label="Deductions" value={money(t.deductions)} />
            <Row label="Net pay" value={money(t.net)} />
            <Row label="Employer cost" value={money(t.employer_cost)} />
            <Row label="PF" value={money(t.pf)} />
            <Row label="ESI" value={money(t.esi)} />
            <Row label="TDS" value={money(t.tds)} />
            <Row label="Prepared by" value={run.prepared_by ?? run.preparedBy} />
            <Row label="Payment reference" value={run.payment_reference ?? run.paymentRef} />
          </Card>

          {canDecide ? (
            <View style={{ gap: 10 }}>
              <Button title="Approve" onPress={() => setPrompt('approve')} />
              <Button title="Reject" variant="danger" onPress={() => setPrompt('reject')} />
            </View>
          ) : null}

          {lines.length ? (
            <>
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 16 }}>Employees ({lines.length})</Text>
              {lines.map((l, i) => (
                <Card key={String(l.employee_id ?? l.empId ?? i)} style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: c.text, fontWeight: '600', flexShrink: 1 }}>
                      {l.employee_name ?? l.name ?? l.employee_code ?? 'Employee'}
                    </Text>
                    <Text style={{ color: c.text, fontWeight: '700' }}>{money(l.net)}</Text>
                  </View>
                  <Muted style={{ fontSize: 12 }}>
                    {[
                      l.employee_code,
                      l.dept,
                      l.earnedGross != null ? `Gross ${money(l.earnedGross)}` : null,
                      l.totalDeductions != null ? `Ded. ${money(l.totalDeductions)}` : null,
                      l.lop ? `LOP ${l.lop}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Muted>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}

      <ReasonModal
        visible={prompt !== null}
        title={prompt === 'approve' ? 'Approve payroll run' : 'Reject payroll run'}
        confirmLabel={prompt === 'approve' ? 'Approve' : 'Reject'}
        busy={decide.isPending}
        onCancel={() => setPrompt(null)}
        onConfirm={(remarks) => prompt && decide.mutate({ decision: prompt, remarks })}
      />
    </Page>
  );
}
