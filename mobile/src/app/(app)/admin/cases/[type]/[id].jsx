import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  actionEffect,
  caseTypeOf,
  decideResignation,
  decideTermination,
  decideTransfer,
  listCases,
  updateRetirementStatus,
} from '@/api/admin/cases';
import { personName } from '@/api/admin/common';
import { getEmployeeById } from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const inr = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
const yes = (v) => (v ? 'Yes' : 'No');
const d = (v) => (v ? fmtDate(v) : '');
const toneOf = (s = '') =>
  /effective|approved|completed|active/i.test(s)
    ? 'success'
    : /reject|withdrawn/i.test(s)
      ? 'danger'
      : /pending|scheduled|processed/i.test(s)
        ? 'warning'
        : undefined;

/** [label, value] rows for each response schema (app/schemas/lifecycle.py *Response). */
function detailRows(type, r) {
  switch (type) {
    case 'transfers':
      return [
        ['Type', r.type],
        ['Effective from', d(r.effective_from)],
        ['To branch', r.to_branch_id ? 'Changed' : 'No change'],
        ['To department', r.to_department_id ? 'Changed' : 'No change'],
        ['Reporting manager', r.to_manager_id ? 'Changed' : 'No change'],
        ['To company', r.to_company_id && r.to_company_id !== r.from_company_id ? 'Changed' : 'No change'],
        ['New designation', r.new_designation || 'Unchanged'],
        ['Reason', r.reason],
        ['Requested by', r.requested_by],
        ['Handover', `${Number(r.notice_days) || 0} days${r.handover_to ? ` · to ${r.handover_to}` : ''}`],
        ['Assets to return', r.assets_to_return],
        ['Relocation allowance', inr(r.relocation_allowance)],
        ['Joining travel', r.joining_travel ? 'Yes — as per policy' : 'No'],
      ];
    case 'resignations':
      return [
        ['Submitted by', r.submitted_by === 'HR_ON_BEHALF' ? 'HR on behalf' : r.submitted_by === 'EMPLOYEE_SELF' ? 'Employee' : r.submitted_by],
        ['Submission date', d(r.submission_date)],
        ['Requested last day', d(r.requested_last_working_day)],
        ['Approved last day', d(r.approved_last_working_day)],
        ['Reason', r.reason],
        ['Description', r.description],
        ['Document', r.document_url],
        ['Remarks', r.remarks],
      ];
    case 'terminations':
      return [
        ['Type', r.type],
        ['Reason', r.reason],
        ['Description', r.description],
        ['Incident date', d(r.incident_date)],
        ['Notice', `${r.notice_mode ?? ''}${Number(r.notice_days) ? ` · ${r.notice_days} days` : ''}`],
        ['Last working day', d(r.last_working_day)],
        ['Show-cause issued', yes(r.show_cause_issued)],
        ['Hearing date', d(r.hearing_date)],
        ['Employee response', r.employee_response],
        ['Legal review', r.legal_review ? 'Required' : 'Not required'],
        ['Gratuity', r.gratuity_forfeited ? 'Forfeited' : 'Payable as per Act'],
        ['Assets recovered', yes(r.assets_recovered)],
        ['Access revoked', yes(r.access_revoked)],
        ['Evidence', (r.evidence_files ?? []).join(', ')],
      ];
    case 'warnings':
      return [
        ['Type', r.type],
        ['Severity', r.severity],
        ['Category', r.category],
        ['Incident date', d(r.incident_date)],
        ['Description', r.description],
        ['Improvement plan', r.improvement_plan],
        ['Review date', d(r.review_date)],
        ['Valid for', `${Number(r.validity_months) || 0} months`],
        ['PIP linked', yes(r.pip_linked)],
        ['Issued on', d(r.issued_on)],
        ['Letter', r.letter_ref],
        ['Acknowledged', r.acknowledged ? `Yes${r.acknowledged_on ? ` · ${fmtDate(r.acknowledged_on)}` : ''}` : 'Not yet'],
        ['Employee comment', r.employee_comment],
        ['Evidence', (r.evidence_files ?? []).join(', ')],
      ];
    case 'insurance':
      return [
        ['Insurer', r.insurer_name],
        ['Policy number', r.policy_number],
        ['Plan type', r.plan_type],
        ['Sum insured', inr(r.coverage_amount)],
        ['Validity', `${d(r.start_date)} → ${d(r.expiry_date)}`],
        [
          'Dependents',
          (r.dependents ?? [])
            .map((x) => [x?.name, x?.relation].filter(Boolean).join(' · '))
            .filter(Boolean)
            .join(', '),
        ],
      ];
    case 'retirements':
      return [
        ['Retirement date', d(r.retired_on)],
        ['Reason', r.reason],
        ['Gratuity', r.gratuity_eligible ? inr(r.gratuity_amount) : 'Not eligible'],
        ['Re-engage on contract', r.re_engage_contract ? `Yes · ${Number(r.extension_months) || 0} months` : 'No'],
        ...(r.re_engage_contract ? [['Extension CTC', inr(r.extension_ctc)]] : []),
        ['Remarks', r.remarks],
      ];
    default:
      return [];
  }
}

/** One lifecycle case (from the GET /cases/{type} list — there is no GET by id) + decision / status action. */
export default function AdminCaseDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { type, id } = useLocalSearchParams();
  const cfg = caseTypeOf(type);
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit');
  const q = useQuery({
    queryKey: ['admin', 'cases', String(type), 'all', ''],
    queryFn: () => listCases(String(type)),
    enabled: !!cfg,
  });
  const r = (q.data ?? []).find((x) => String(x.id) === String(id));
  const emp = useQuery({
    queryKey: ['admin', 'cases', 'employee', String(r?.employee_id ?? '')],
    queryFn: () => getEmployeeById(String(r.employee_id)),
    enabled: !!r?.employee_id,
  });
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [approvedLwd, setApprovedLwd] = useState('');

  const act = useMutation({
    mutationFn: (value) => {
      const rid = String(r.id);
      if (cfg.key === 'transfers') return decideTransfer(rid, { decision: value, note });
      if (cfg.key === 'resignations')
        return decideResignation(rid, {
          decision: value,
          approvedLastWorkingDay: value === 'Approved' ? approvedLwd || r.requested_last_working_day : undefined,
          remarks: note,
        });
      if (cfg.key === 'terminations') return decideTermination(rid, { decision: value, remarks: note });
      return updateRetirementStatus(rid, { status: value, remarks: note });
    },
    onSuccess: (_d, value) => {
      qc.invalidateQueries({ queryKey: ['admin', 'cases', cfg.key] });
      qc.invalidateQueries({ queryKey: ['admin', 'employees'] });
      setChoice('');
      setNote('');
      Alert.alert(cfg.singular, `Marked ${value}.`);
    },
    onError: (e) => Alert.alert(cfg.singular, errorMessage(e)),
  });

  if (!cfg)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Case" />
        <Muted style={{ padding: 16 }}>Unknown case type.</Muted>
      </View>
    );
  if (q.isLoading)
    return (
      <View style={{ flex: 1 }}>
        <Header title={cfg.singular} />
        <Loading />
      </View>
    );

  const e = emp.data ?? {};
  const isFinal = r && cfg.finalStatuses.map((s) => s.toLowerCase()).includes(String(r.status).toLowerCase());
  const choices = cfg.actionValues.filter((v) => v.toLowerCase() !== String(r?.status ?? '').toLowerCase());
  const confirm = () => {
    if (!choice) return Alert.alert(cfg.singular, 'Choose a decision first.');
    const effect = actionEffect(cfg.key, choice);
    Alert.alert(
      cfg.action === 'status' ? 'Update status' : 'Record decision',
      `Mark this ${cfg.singular.toLowerCase()} as ${choice}?${effect ? `\n\n${effect}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: /reject/i.test(choice) ? 'destructive' : 'default', onPress: () => act.mutate(choice) },
      ],
    );
  };
  const approvals = Array.isArray(r?.approvals) ? r.approvals : [];

  return (
    <View style={{ flex: 1 }}>
      <Header title={r?.id ? String(r.id) : cfg.singular} />
      <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
        {q.error ? <ErrorText>{errorMessage(q.error, `Could not load the ${cfg.singular.toLowerCase()}.`)}</ErrorText> : null}
        {!r && !q.error ? <Muted>This {cfg.singular.toLowerCase()} was not found in your scope.</Muted> : null}
        {r ? (
          <>
            <Card style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 17, flexShrink: 1 }}>
                  {personName(e) || (emp.isLoading ? 'Loading…' : 'Employee')}
                </Text>
                <Badge label={r.status} tone={toneOf(r.status)} />
              </View>
              <Row label="Employee code" value={e.employee_code} />
              <Row label="Department" value={e.department_name ?? e.department} />
              <Row label="Designation" value={e.designation_name ?? e.designation} />
              <Row label="Recorded on" value={d(r.created_at)} />
            </Card>
            <Card style={{ gap: 4 }}>
              {detailRows(cfg.key, r).map(([label, value]) => (
                <Row key={label} label={label} value={value} />
              ))}
            </Card>
            {approvals.length ? (
              <Card style={{ gap: 6 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>Approvals</Text>
                {approvals.map((a, i) => (
                  <View key={i} style={{ gap: 2 }}>
                    <Text style={{ color: c.text }}>{a.decision}</Text>
                    <Muted style={{ fontSize: 12 }}>
                      {[a.by, a.on ? fmtDate(a.on) : null, a.note || a.remarks].filter(Boolean).join(' · ')}
                    </Muted>
                  </View>
                ))}
              </Card>
            ) : null}
            {canEdit && cfg.action && !isFinal ? (
              <Card style={{ gap: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>
                  {cfg.action === 'status' ? 'Update status' : 'Decision'}
                </Text>
                <Select
                  label={cfg.action === 'status' ? 'New status' : 'Decision'}
                  value={choice}
                  onChange={setChoice}
                  options={choices.map((v) => ({ label: v, value: v }))}
                  placeholder="Choose…"
                />
                {cfg.key === 'resignations' && choice === 'Approved' ? (
                  <DateField
                    label="Approved last working day"
                    value={approvedLwd || String(r.requested_last_working_day ?? '')}
                    onChange={setApprovedLwd}
                  />
                ) : null}
                <Field
                  label={cfg.key === 'transfers' ? 'Note' : 'Remarks'}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                {choice && actionEffect(cfg.key, choice) ? <Muted>{actionEffect(cfg.key, choice)}</Muted> : null}
                <Button
                  title={cfg.action === 'status' ? 'Update status' : 'Submit decision'}
                  variant={/reject/i.test(choice) ? 'danger' : 'primary'}
                  loading={act.isPending}
                  onPress={confirm}
                />
              </Card>
            ) : null}
          </>
        ) : null}
      </Page>
    </View>
  );
}
