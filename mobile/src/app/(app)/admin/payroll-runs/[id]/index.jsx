import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import {
  EDITABLE,
  acknowledgePayrollWarnings,
  decidePayrollRun,
  escalatePayrollCheck,
  getPaymentRecords,
  getPayrollRun,
  payPayrollRun,
  processPayrollRun,
  publishPayslips,
  reopenPayrollRun,
  resolvePayrollCheck,
  runPayrollChecks,
  sendBackPayrollRun,
  shareRegisterCsv,
  submitPayrollRun,
  uploadPaymentAdvice,
} from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { Badge, Header, Page, Segments } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const money = (v) =>
  v == null || v === '' || Number.isNaN(Number(v))
    ? '—'
    : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.valueOf()) ? String(v) : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};
const RUN_TONE = {
  Draft: 'muted',
  'Checks Failed': 'danger',
  'Checks Passed': 'success',
  'Pending Approval': 'warning',
  Approved: 'primary',
  Processed: 'primary',
  Paid: 'success',
  Rejected: 'danger',
};
const SEVERITY_TONE = { error: 'danger', warning: 'warning', info: 'primary' };
const PICK_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
];
const roleNames = (me) =>
  [me?.role, me?.role_name, me?.user?.role, ...(me?.roles ?? me?.user?.roles ?? [])]
    .map((r) => String(typeof r === 'string' ? r : (r?.name ?? '')).trim())
    .filter(Boolean);

/** Text prompt (Alert.prompt is iOS-only): remarks, a note, a payment reference. */
function PromptModal({ prompt, busy, onCancel, onConfirm }) {
  const c = useColors();
  const [text, setText] = useState('');
  useEffect(() => setText(''), [prompt]);
  return (
    <Modal visible={!!prompt} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }} onPress={onCancel}>
        <Pressable style={{ backgroundColor: c.card, borderRadius: 16, padding: 16, gap: 12 }} onPress={() => {}}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{prompt?.title}</Text>
          <Field
            label={`${prompt?.label ?? 'Note'}${prompt?.required ? ' *' : ''}`}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
          <Button
            title={prompt?.confirmLabel ?? 'Confirm'}
            onPress={() => onConfirm(text.trim())}
            loading={busy}
            disabled={!!prompt?.required && !text.trim()}
          />
          <Button title="Cancel" variant="outline" onPress={onCancel} disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Approval levels with who decided (web: Stepper). */
function Stepper({ run }) {
  const c = useColors();
  const levels = run.approval_levels ?? [];
  if (!levels.length) return null;
  return (
    <Card style={{ gap: 8 }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>Approval levels</Text>
      {levels.map((lv) => {
        const a = (run.approvals ?? []).find((x) => x.level_no === lv.level_no);
        const current = run.status === 'Pending Approval' && run.next_action?.level_no === lv.level_no;
        const remarks = a?.remarks ?? a?.remark ?? a?.comment;
        return (
          <View key={lv.level_no} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: c.text, flexShrink: 1 }}>
                {lv.level_no}. {lv.name}
              </Text>
              <Badge
                label={a ? (a.decision === 'approve' ? 'Approved' : 'Rejected') : current ? 'Waiting' : 'Pending'}
                tone={a ? (a.decision === 'approve' ? 'success' : 'danger') : current ? 'warning' : 'muted'}
              />
            </View>
            {a?.by ? <Muted style={{ fontSize: 12 }}>by {a.by}</Muted> : null}
            {remarks ? <Muted style={{ fontSize: 12 }}>“{remarks}”</Muted> : null}
          </View>
        );
      })}
    </Card>
  );
}

function paymentRows(body) {
  const rows = Array.isArray(body) ? body : (body?.items ?? body?.records ?? body?.payment_records ?? []);
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    ...r,
    paid: String(r.payment_status ?? r.status ?? '').toLowerCase() === 'paid',
  }));
}

/** Payroll run detail (web: PayrollRunsTab.jsx → RunDetail): status-driven actions, register, checks, payments. */
export default function PayrollRunDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const runId = String(id ?? '');
  const { can, me } = useAccess();
  const [view, setView] = useState('register');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const [prompt, setPrompt] = useState(null);
  const [busy, setBusy] = useState('');
  const [published, setPublished] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useQuery({
    queryKey: ['admin', 'payroll-run', runId, search, state],
    queryFn: () => getPayrollRun(runId, { q: search, state }),
    enabled: !!runId,
    placeholderData: (prev) => prev,
  });
  const run = q.data ?? {};
  const s = run.status;
  const canUploadPayments = can('payroll.process') || can('finance.manage');
  const showPayments = canUploadPayments && ['Processed', 'Paid'].includes(s);

  const pay = useQuery({
    queryKey: ['admin', 'payroll-run-payments', runId, run.period],
    queryFn: async () => {
      const [paid, unpaid] = await Promise.all([
        getPaymentRecords(runId, run.period, 'paid'),
        getPaymentRecords(runId, run.period, 'unpaid'),
      ]);
      return { paid: paymentRows(paid), unpaid: paymentRows(unpaid) };
    },
    enabled: !!runId && !!run.period && showPayments,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'payroll-run', runId] });
    qc.invalidateQueries({ queryKey: ['admin', 'payroll-run-payments', runId] });
    qc.invalidateQueries({ queryKey: ['admin', 'payroll-runs'] });
  };

  /** Runs an action (its answer is the refreshed run), then reloads. A 409 means the state moved: show it. */
  const act = async (key, fn, okMessage) => {
    setBusy(key);
    try {
      await fn();
      if (okMessage) Alert.alert('Payroll', okMessage);
      return true;
    } catch (e) {
      Alert.alert('Payroll', errorMessage(e));
      return false;
    } finally {
      setBusy('');
      refreshAll();
    }
  };

  const ask = (p) => setPrompt(p);
  const onPromptConfirm = async (value) => {
    const ok = await act('prompt', () => prompt.run(value), prompt.ok);
    if (ok) setPrompt(null);
  };

  const uploadPayments = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES, copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return;
    setBusy('upload');
    try {
      const result = await uploadPaymentAdvice(run.id, run.period, res.assets[0]);
      if (!result?.success || result.errors?.length) {
        const details = (result?.errors ?? []).slice(0, 3).map((item) => {
          const row = item.row ? `Row ${item.row}${item.employee_code ? ` (${item.employee_code})` : ''}: ` : '';
          return `${row}${item.error}`;
        });
        const remaining = (result?.errors?.length ?? 0) - details.length;
        throw new Error(
          details.length
            ? `${details.join('\n')}${remaining > 0 ? `\nand ${remaining} more error(s)` : ''}`
            : 'The payment advice could not be processed.',
        );
      }
      setView('paid');
      Alert.alert(
        'Payroll',
        `Payment advice uploaded for ${result.paid_employees ?? result.validated_rows ?? 0} employee(s) across ${
          result.transaction_count ?? 0
        } transaction(s).`,
      );
    } catch (e) {
      Alert.alert('Payment upload', errorMessage(e, 'Could not upload the payment workbook.'));
    } finally {
      setBusy('');
      refreshAll();
    }
  };

  const generateSlips = async () => {
    setBusy('publish');
    try {
      await publishPayslips(run.id, run.period);
      setPublished(true);
    } catch (e) {
      Alert.alert('Salary slips', errorMessage(e, 'Could not generate the salary slips.'));
    } finally {
      setBusy('');
    }
  };

  if (q.isLoading)
    return (
      <Page>
        <Header title="Payroll run" />
        <Loading />
      </Page>
    );
  if (q.error && !q.data)
    return (
      <Page onRefresh={() => q.refetch()}>
        <Header title="Payroll run" />
        <ErrorText>{errorMessage(q.error, 'Could not load the payroll run.')}</ErrorText>
      </Page>
    );

  const t = run.totals ?? {};
  const next = run.next_action ?? {};
  const lines = Array.isArray(run.lines) ? run.lines : [];
  const checks = Array.isArray(run.checks) ? run.checks : [];
  const openChecks = checks.filter((x) => x.status === 'open').length;
  const openWarnings = checks.filter((x) => x.severity === 'warning' && x.status === 'open').length;
  const canRun = can('payroll.run');
  const canApprove = can('payroll.approve');
  const canProcess = can('payroll.process');
  // Web rule: only an "HR Manager" with payroll.view may generate salary slips.
  const isHrManager = roleNames(me).some((r) => r.toLowerCase().replace(/_/g, ' ') === 'hr manager');
  const canPublish = isHrManager && can('payroll.view');
  const slipsPublished = Boolean(run.payslips_published_at || run.payslips_published || published);
  const editable = canRun && EDITABLE.includes(s);
  const working = !!busy;

  const tabs = [
    { label: `Employees (${lines.length})`, value: 'register' },
    ...(showPayments
      ? [
          { label: `Paid (${pay.data?.paid.length ?? 0})`, value: 'paid' },
          { label: `Unpaid (${pay.data?.unpaid.length ?? 0})`, value: 'unpaid' },
        ]
      : []),
    { label: `Checks (${openChecks})`, value: 'checks' },
    { label: 'History', value: 'history' },
  ];

  return (
    <Page onRefresh={() => (q.refetch(), showPayments && pay.refetch())} refreshing={q.isRefetching}>
      <Header title={run.period ? `Payroll ${run.period}` : 'Payroll run'} />

      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', flexShrink: 1 }}>
            {run.title || `Payroll ${run.period ?? ''}`}
          </Text>
          <Badge label={s} tone={RUN_TONE[s]} />
        </View>
        <Muted>
          Pay date {run.pay_date ?? '—'} · prepared by {run.prepared_by?.name ?? run.prepared_by ?? '—'}
        </Muted>
        {next.label || next.message ? <Muted>{next.label || next.message}</Muted> : null}
      </Card>

      {run.attendance_locked === false ? (
        <Card style={{ borderColor: c.warning }}>
          <Text style={{ color: c.warning }}>
            Attendance for {run.period} is not locked. Lock it (Attendance → Payroll attendance lock) before continuing.
          </Text>
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- actions (same rules as web) */}
      <View style={{ gap: 10 }}>
        {editable ? (
          <Button
            title={s === 'Draft' ? 'Run checks' : 'Re-run checks'}
            loading={busy === 'checks'}
            disabled={working}
            onPress={() => act('checks', () => runPayrollChecks(run.id), 'Checks completed.')}
          />
        ) : null}
        {canRun && s === 'Checks Passed' ? (
          <>
            {openWarnings > 0 ? (
              <Button
                title={`Acknowledge ${openWarnings} warning${openWarnings === 1 ? '' : 's'}`}
                variant="outline"
                loading={busy === 'ack'}
                disabled={working}
                onPress={() => act('ack', () => acknowledgePayrollWarnings(run.id), 'Warnings acknowledged.')}
              />
            ) : null}
            <Button
              title="Submit for approval"
              loading={busy === 'submit'}
              disabled={working || openWarnings > 0}
              onPress={() => act('submit', () => submitPayrollRun(run.id), 'Submitted for approval.')}
            />
          </>
        ) : null}
        {editable ? (
          <Button
            title="Adjustments"
            variant="outline"
            onPress={() => router.push(`/admin/payroll/adjustments?runId=${encodeURIComponent(run.id)}`)}
          />
        ) : null}
        {s === 'Pending Approval' && canApprove && next.can_act ? (
          <>
            <Button
              title="Approve"
              disabled={working}
              onPress={() =>
                ask({
                  title: 'Approve payroll run',
                  label: 'Reason for approval',
                  required: true,
                  confirmLabel: 'Approve',
                  ok: 'Payroll approved.',
                  run: (v) => decidePayrollRun(run.id, 'approve', v),
                })
              }
            />
            <Button
              title="Reject"
              variant="danger"
              disabled={working}
              onPress={() =>
                ask({
                  title: 'Reject payroll run',
                  label: 'Reason for rejection',
                  required: true,
                  confirmLabel: 'Reject',
                  ok: 'Run rejected.',
                  run: (v) => decidePayrollRun(run.id, 'reject', v),
                })
              }
            />
            <Button
              title="Send back to draft"
              variant="outline"
              disabled={working}
              onPress={() =>
                ask({
                  title: 'Send back to draft',
                  label: 'Remark',
                  required: true,
                  confirmLabel: 'Send back',
                  ok: 'Sent back to draft.',
                  run: (v) => sendBackPayrollRun(run.id, v),
                })
              }
            />
          </>
        ) : null}
        {canProcess && s === 'Approved' ? (
          <Button
            title="Process payroll"
            loading={busy === 'process'}
            disabled={working}
            onPress={() =>
              Alert.alert('Process payroll', `Process the ${run.period} payroll and create payslips?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Process',
                  onPress: () =>
                    act('process', () => processPayrollRun(run.id), 'Payroll processed — payslips created.'),
                },
              ])
            }
          />
        ) : null}
        {canProcess && s === 'Processed' ? (
          <Button
            title="Mark paid"
            disabled={working}
            onPress={() =>
              ask({
                title: 'Mark as paid',
                label: 'Payment reference',
                required: true,
                confirmLabel: 'Mark paid',
                ok: 'Marked as paid.',
                run: (v) => payPayrollRun(run.id, v),
              })
            }
          />
        ) : null}
        {canRun && ['Rejected', 'Checks Failed', 'Checks Passed'].includes(s) ? (
          <Button
            title="Reopen as draft"
            variant="outline"
            loading={busy === 'reopen'}
            disabled={working}
            onPress={() => act('reopen', () => reopenPayrollRun(run.id), 'Run reopened as draft.')}
          />
        ) : null}
        {showPayments ? (
          <View style={{ gap: 4 }}>
            <Button
              title={busy === 'upload' ? 'Uploading…' : 'Upload payment advice (Excel / CSV)'}
              variant="outline"
              loading={busy === 'upload'}
              disabled={working}
              onPress={uploadPayments}
            />
            <Muted style={{ fontSize: 12 }}>
              The bank advice is validated row by row; the run is marked paid when every payment succeeded.
            </Muted>
          </View>
        ) : null}
        {canPublish && s === 'Paid' ? (
          <Button
            title={slipsPublished ? 'Salary slips generated' : 'Generate salary slips'}
            variant="outline"
            loading={busy === 'publish'}
            disabled={working || slipsPublished}
            onPress={generateSlips}
          />
        ) : null}
        {['Processed', 'Paid'].includes(s) ? (
          <Button
            title="Payroll register CSV"
            variant="outline"
            loading={busy === 'csv'}
            disabled={working}
            onPress={async () => {
              setBusy('csv');
              try {
                await shareRegisterCsv(run);
              } catch (e) {
                Alert.alert('Payroll', errorMessage(e));
              } finally {
                setBusy('');
              }
            }}
          />
        ) : null}
      </View>

      <Stepper run={run} />

      <Card style={{ gap: 0 }}>
        <Row label="Employees" value={t.employees != null ? String(t.employees) : null} />
        <Row label="Gross" value={money(t.gross)} />
        <Row label="Deductions" value={money(t.deductions)} />
        <Row label="Net pay" value={money(t.net)} />
        <Row label="Employer cost" value={money(t.employer_cost)} />
        <Row label="PF" value={money(t.pf)} />
        <Row label="ESI" value={money(t.esi)} />
        <Row label="TDS" value={money(t.tds)} />
        {run.processed_at ? (
          <Row label="Processed" value={`${when(run.processed_at)} · ${run.processed_by?.name ?? '—'}`} />
        ) : null}
        {run.paid_at ? <Row label="Paid" value={when(run.paid_at)} /> : null}
        {run.payment_reference ? <Row label="Payment reference" value={run.payment_reference} /> : null}
      </Card>

      <Segments value={view} onChange={setView} options={tabs} />

      {view === 'register' ? (
        <>
          <Field label="Search" value={text} onChangeText={setText} placeholder="Name or code" autoCapitalize="none" />
          <Segments
            value={state}
            onChange={setState}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Errors', value: 'error' },
              { label: 'Warnings', value: 'warning' },
              { label: 'Clean', value: 'ok' },
            ]}
          />
          {lines.length === 0 ? <Muted>No rows to show.</Muted> : null}
          {lines.map((l, i) => (
            <Pressable
              key={String(l.employee_id ?? i)}
              onPress={() =>
                router.push(
                  `/admin/payroll-runs/${encodeURIComponent(run.id)}/lines/${encodeURIComponent(String(l.employee_id))}`,
                )
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
              <Card style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: c.text, fontWeight: '600', flexShrink: 1 }}>
                    {l.employee_name ?? l.employee_code ?? 'Employee'}
                  </Text>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{money(l.net)}</Text>
                </View>
                <Muted style={{ fontSize: 12 }}>
                  {[l.employee_code, l.department, l.wage_type].filter(Boolean).join(' · ')}
                </Muted>
                <Muted style={{ fontSize: 12 }}>
                  {[
                    `Paid days ${l.paid_days ?? l.lop?.payable_days ?? '—'}`,
                    `LOP ${l.lop?.days ?? 0}`,
                    Number(l.ot_hours) ? `OT ${l.ot_hours}h (${money(l.ot_amount)})` : null,
                    `Gross ${money(l.earned_gross)}`,
                    `Ded. ${money(l.total_deductions)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      {view === 'paid' || view === 'unpaid' ? (
        pay.isLoading ? (
          <Loading />
        ) : pay.error ? (
          <ErrorText>{errorMessage(pay.error, 'Could not load payment records.')}</ErrorText>
        ) : (
          <>
            {(pay.data?.[view] ?? []).length === 0 ? (
              <Muted>
                No {view} payment records found for {run.period}.
              </Muted>
            ) : null}
            {(pay.data?.[view] ?? []).map((r, i) => (
              <Card key={`${r.employee_id ?? r.employee_code}-${i}`} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: c.text, fontWeight: '600', flexShrink: 1 }}>
                    {r.employee_name || r.employee_code || 'Employee'}
                  </Text>
                  <Badge label={r.paid ? 'Paid' : 'Unpaid'} tone={r.paid ? 'success' : 'warning'} />
                </View>
                <Muted style={{ fontSize: 12 }}>
                  {[r.employee_code, `Net ${money(r.net)}`, r.bank_account, r.ifsc].filter(Boolean).join(' · ')}
                </Muted>
                {r.transaction_id || r.bank_status ? (
                  <Muted style={{ fontSize: 12 }}>
                    {[r.transaction_id ? `UTR ${r.transaction_id}` : null, r.bank_status].filter(Boolean).join(' · ')}
                  </Muted>
                ) : null}
              </Card>
            ))}
          </>
        )
      ) : null}

      {view === 'checks' ? (
        <>
          {checks.length === 0 ? (
            <Muted>{s === 'Draft' ? 'Run checks to validate this payroll.' : 'No checks raised.'}</Muted>
          ) : null}
          {checks.map((ch) => (
            <Card key={String(ch.id)} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <Badge label={ch.code} tone={SEVERITY_TONE[ch.severity] ?? 'primary'} />
                <Badge label={ch.status} tone={ch.status === 'open' ? 'warning' : 'muted'} />
              </View>
              <Text style={{ color: c.text }}>{ch.message}</Text>
              <Muted style={{ fontSize: 12 }}>
                {ch.employee_name ?? 'Whole run'}
                {ch.resolution_note ? ` · ${ch.resolution_note}` : ''}
              </Muted>
              {ch.code === 'DAILY-RATE-MISSING' && ch.employee_id ? (
                <Pressable onPress={() => router.push(`/admin/employees/${encodeURIComponent(ch.employee_id)}`)}>
                  <Text style={{ color: c.primary, fontWeight: '600' }}>Set the daily rate</Text>
                </Pressable>
              ) : null}
              {editable && ['open', 'escalated'].includes(ch.status) ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Fixed"
                      variant="outline"
                      disabled={working}
                      onPress={() =>
                        act('check', () => resolvePayrollCheck(run.id, ch.id, { action: 'fix', note: '' }), 'Marked as fixed.')
                      }
                    />
                  </View>
                  {ch.code !== 'ATT-LOCK' ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Override"
                        variant="outline"
                        disabled={working}
                        onPress={() =>
                          ask({
                            title: `Override ${ch.code}`,
                            label: 'Note',
                            required: true,
                            confirmLabel: 'Override',
                            ok: 'Check overridden.',
                            run: (v) => resolvePayrollCheck(run.id, ch.id, { action: 'override', note: v }),
                          })
                        }
                      />
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Escalate"
                      variant="outline"
                      disabled={working}
                      onPress={() =>
                        ask({
                          title: `Escalate ${ch.code}`,
                          label: 'Note',
                          required: false,
                          confirmLabel: 'Escalate',
                          ok: 'Check escalated.',
                          run: (v) => escalatePayrollCheck(run.id, ch.id, v ? { note: v } : {}),
                        })
                      }
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {view === 'history' ? (
        <Card style={{ gap: 0 }}>
          {(run.history ?? []).length === 0 ? <Muted>No activity yet.</Muted> : null}
          {(run.history ?? []).map((h, i) => (
            <View key={i} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: c.border, gap: 2 }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{h.action}</Text>
              <Muted style={{ fontSize: 12 }}>
                {when(h.at)} · {h.by ?? '—'}
              </Muted>
              {h.remark ? <Muted style={{ fontSize: 13 }}>{h.remark}</Muted> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <PromptModal
        prompt={prompt}
        busy={busy === 'prompt'}
        onCancel={() => setPrompt(null)}
        onConfirm={onPromptConfirm}
      />
    </Page>
  );
}
