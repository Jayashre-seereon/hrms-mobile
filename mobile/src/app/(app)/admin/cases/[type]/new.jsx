import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  caseTypeOf,
  createCase,
  DEPENDENT_RELATIONS,
  NOTICE_MODES,
  RETIREMENT_REASONS,
  TERMINATION_TYPES,
  TRANSFER_REQUESTED_BY,
  TRANSFER_TYPES,
  WARNING_CATEGORIES,
  WARNING_SEVERITIES,
  WARNING_TYPES,
} from '@/api/admin/cases';
import { personName } from '@/api/admin/common';
import {
  getBranches,
  getDepartmentOptions,
  getDesignationOptions,
  getEmployeeById,
  getEmployees,
  getStaffOptions,
} from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Muted, Row } from '@/ui/components';
import { DateField, Header, Page, Select, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const NONE = '__none__';
const safe = (fn) => () => fn().catch(() => []);
const opts = (list) => list.map((x) => ({ label: x, value: x }));
const int = (v) => (String(v).trim() === '' ? undefined : Math.trunc(Number(v)));
const dec = (v) => (String(v).trim() === '' ? undefined : String(Number(v)));
const txt = (v) => (String(v ?? '').trim() ? String(v).trim() : undefined);
const pick = (v) => (v && v !== NONE ? v : undefined);
const badNum = (v) => String(v ?? '').trim() !== '' && (Number.isNaN(Number(v)) || Number(v) < 0);

/** Defaults per type — the *Create schema defaults (app/schemas/lifecycle.py). */
const INITIAL = {
  transfers: {
    type: 'Branch',
    to_branch_id: NONE,
    to_department_id: NONE,
    to_manager_id: NONE,
    new_designation: NONE,
    effective_from: '',
    notice_days: '0',
    reason: '',
    requested_by: 'HR',
    relocation_allowance: '0',
    joining_travel: false,
    handover_to: '',
    assets_to_return: '',
  },
  resignations: {
    submission_date: toISODate(new Date()),
    requested_last_working_day: '',
    reason: '',
    description: '',
  },
  terminations: {
    type: TERMINATION_TYPES[0],
    reason: '',
    description: '',
    incident_date: '',
    notice_mode: 'Immediate (misconduct)',
    notice_days: '0',
    last_working_day: '',
    hearing_date: '',
    show_cause_issued: false,
    employee_response: '',
    legal_review: false,
    gratuity_forfeited: false,
    assets_recovered: false,
    access_revoked: false,
  },
  warnings: {
    type: WARNING_TYPES[0],
    severity: WARNING_SEVERITIES[0],
    category: WARNING_CATEGORIES[0],
    incident_date: '',
    description: '',
    improvement_plan: '',
    review_date: '',
    validity_months: '6',
    pip_linked: false,
    issued_on: toISODate(new Date()),
    letter_ref: '',
  },
  insurance: {
    policy_number: '',
    insurer_name: '',
    plan_type: '',
    coverage_amount: '',
    start_date: '',
    expiry_date: '',
    dependents: [],
  },
  retirements: {
    retired_on: '',
    reason: 'Superannuation',
    gratuity_eligible: true,
    gratuity_amount: '0',
    re_engage_contract: false,
    extension_months: '0',
    extension_ctc: '0',
    remarks: '',
  },
};

/** Validates the form and returns { body } (exact *Create schema fields) or { error }. */
function buildBody(type, employeeId, f) {
  if (!employeeId) return { error: 'Select the employee.' };
  const base = { employee_id: employeeId };
  switch (type) {
    case 'transfers': {
      if (!f.effective_from) return { error: 'Effective from date is required.' };
      if (!txt(f.reason)) return { error: 'Reason is required.' };
      if (badNum(f.notice_days) || badNum(f.relocation_allowance))
        return { error: 'Notice days and relocation allowance must be positive numbers.' };
      return {
        body: {
          ...base,
          type: f.type,
          to_branch_id: pick(f.to_branch_id),
          to_department_id: pick(f.to_department_id),
          to_manager_id: pick(f.to_manager_id),
          new_designation: pick(f.new_designation),
          effective_from: f.effective_from,
          notice_days: int(f.notice_days) ?? 0,
          reason: txt(f.reason),
          requested_by: f.requested_by,
          relocation_allowance: dec(f.relocation_allowance) ?? '0',
          joining_travel: !!f.joining_travel,
          handover_to: txt(f.handover_to),
          assets_to_return: txt(f.assets_to_return),
        },
      };
    }
    case 'resignations': {
      if (!f.submission_date || !f.requested_last_working_day)
        return { error: 'Submission date and requested last working day are required.' };
      if (f.requested_last_working_day < f.submission_date)
        return { error: 'Last working day cannot be before the submission date.' };
      if (!txt(f.reason)) return { error: 'Reason is required.' };
      return {
        body: {
          ...base,
          submission_date: f.submission_date,
          requested_last_working_day: f.requested_last_working_day,
          reason: txt(f.reason),
          description: txt(f.description),
        },
      };
    }
    case 'terminations': {
      if (!txt(f.type) || !txt(f.reason)) return { error: 'Type and reason are required.' };
      if (badNum(f.notice_days)) return { error: 'Notice days must be a positive number.' };
      const immediate = f.notice_mode === 'Immediate (misconduct)';
      return {
        body: {
          ...base,
          type: f.type,
          reason: txt(f.reason),
          description: txt(f.description),
          incident_date: f.incident_date || undefined,
          notice_mode: f.notice_mode,
          notice_days: immediate ? 0 : (int(f.notice_days) ?? 0),
          last_working_day: f.last_working_day || undefined,
          hearing_date: f.hearing_date || undefined,
          show_cause_issued: !!f.show_cause_issued,
          employee_response: txt(f.employee_response),
          legal_review: !!f.legal_review,
          gratuity_forfeited: !!f.gratuity_forfeited,
          assets_recovered: !!f.assets_recovered,
          access_revoked: !!f.access_revoked,
        },
      };
    }
    case 'warnings': {
      if (!f.incident_date || !f.issued_on) return { error: 'Incident date and issued on date are required.' };
      if (!txt(f.description)) return { error: 'Description is required.' };
      if (badNum(f.validity_months)) return { error: 'Validity must be a positive number of months.' };
      return {
        body: {
          ...base,
          type: f.type,
          severity: f.severity,
          category: f.category,
          incident_date: f.incident_date,
          description: txt(f.description),
          improvement_plan: txt(f.improvement_plan),
          review_date: f.review_date || undefined,
          validity_months: int(f.validity_months) ?? 6,
          pip_linked: !!f.pip_linked,
          issued_on: f.issued_on,
          letter_ref: txt(f.letter_ref),
        },
      };
    }
    case 'insurance': {
      if (!txt(f.policy_number) || !txt(f.insurer_name) || !txt(f.plan_type))
        return { error: 'Policy number, insurer and plan type are required.' };
      if (String(f.coverage_amount).trim() === '' || badNum(f.coverage_amount))
        return { error: 'Enter a valid coverage amount.' };
      if (!f.start_date || !f.expiry_date) return { error: 'Start and expiry dates are required.' };
      if (f.expiry_date < f.start_date) return { error: 'Expiry date cannot be before the start date.' };
      return {
        body: {
          ...base,
          policy_number: txt(f.policy_number),
          insurer_name: txt(f.insurer_name),
          plan_type: txt(f.plan_type),
          coverage_amount: dec(f.coverage_amount),
          start_date: f.start_date,
          expiry_date: f.expiry_date,
          dependents: f.dependents
            .filter((d) => txt(d.name))
            .map((d) => ({ name: d.name.trim(), relation: d.relation })),
        },
      };
    }
    case 'retirements': {
      if (!f.retired_on) return { error: 'Retirement date is required.' };
      if (badNum(f.gratuity_amount) || badNum(f.extension_months) || badNum(f.extension_ctc))
        return { error: 'Amounts and months must be positive numbers.' };
      return {
        body: {
          ...base,
          retired_on: f.retired_on,
          reason: f.reason,
          gratuity_eligible: !!f.gratuity_eligible,
          gratuity_amount: f.gratuity_eligible ? (dec(f.gratuity_amount) ?? '0') : '0',
          re_engage_contract: !!f.re_engage_contract,
          extension_months: f.re_engage_contract ? (int(f.extension_months) ?? 0) : 0,
          extension_ctc: f.re_engage_contract ? (dec(f.extension_ctc) ?? '0') : '0',
          remarks: txt(f.remarks),
        },
      };
    }
    default:
      return { error: 'Unknown case type.' };
  }
}

function Check({ label, value, onChange }) {
  const c = useColors();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ paddingVertical: 4 }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>
        {value ? '☑' : '☐'} {label}
      </Text>
    </Pressable>
  );
}

/** Transfer destination pickers — sources are the employee form's (departments / designations / managers / branches). */
function TransferFields({ f, set, companyId }) {
  const company = companyId ? String(companyId) : '';
  const branches = useQuery({
    queryKey: ['admin', 'cases', 'transfer', 'branches', company],
    queryFn: safe(() => getBranches(company)),
    enabled: !!company,
  });
  const departments = useQuery({
    queryKey: ['admin', 'cases', 'transfer', 'departments', company],
    queryFn: safe(() => getDepartmentOptions(company)),
  });
  const designations = useQuery({
    queryKey: ['admin', 'cases', 'transfer', 'designations', company],
    queryFn: safe(() => getDesignationOptions(company)),
  });
  const managers = useQuery({
    queryKey: ['admin', 'cases', 'transfer', 'managers', company],
    queryFn: safe(() => getStaffOptions('manager', company)),
  });
  const keep = (label) => [{ label, value: NONE }];
  return (
    <>
      <Card style={{ gap: 12 }}>
        <Select label="Transfer type" value={f.type} options={opts(TRANSFER_TYPES)} onChange={set('type')} />
        <Select
          label="To branch"
          value={f.to_branch_id}
          onChange={set('to_branch_id')}
          options={[
            ...keep('No change'),
            ...(branches.data ?? []).map((b) => ({ label: b.name ?? b.branch_name ?? b.code ?? String(b.id), value: String(b.id) })),
          ]}
        />
        <Select
          label="To department"
          value={f.to_department_id}
          onChange={set('to_department_id')}
          options={[...keep('No change'), ...(departments.data ?? []).map((d) => ({ label: d.name, value: String(d.id) }))]}
        />
        <Select
          label="New reporting manager"
          value={f.to_manager_id}
          onChange={set('to_manager_id')}
          options={[
            ...keep('No change'),
            ...(managers.data ?? []).map((e) => ({
              label: [personName(e), e.employee_code].filter(Boolean).join(' · ') || String(e.id),
              value: String(e.id),
            })),
          ]}
        />
        <Select
          label="New designation"
          value={f.new_designation}
          onChange={set('new_designation')}
          options={[
            ...keep('Unchanged'),
            ...Array.from(new Set((designations.data ?? []).map((d) => d.name).filter(Boolean))).map((n) => ({
              label: n,
              value: n,
            })),
          ]}
        />
        <DateField label="Effective from *" value={f.effective_from} onChange={set('effective_from')} />
        <Field label="Reason *" value={f.reason} onChangeText={set('reason')} multiline />
        <Select label="Requested by" value={f.requested_by} options={opts(TRANSFER_REQUESTED_BY)} onChange={set('requested_by')} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Field label="Handover notice (days)" value={f.notice_days} onChangeText={set('notice_days')} keyboardType="numeric" />
        <Field label="Handover to" value={f.handover_to} onChangeText={set('handover_to')} />
        <Field label="Assets to return" value={f.assets_to_return} onChangeText={set('assets_to_return')} />
        <Field
          label="Relocation allowance (₹)"
          value={f.relocation_allowance}
          onChangeText={set('relocation_allowance')}
          keyboardType="numeric"
        />
        <Check label="Joining travel as per policy" value={f.joining_travel} onChange={set('joining_travel')} />
      </Card>
    </>
  );
}

function ResignationFields({ f, set }) {
  return (
    <Card style={{ gap: 12 }}>
      <DateField label="Submission date *" value={f.submission_date} onChange={set('submission_date')} />
      <DateField
        label="Requested last working day *"
        value={f.requested_last_working_day}
        onChange={set('requested_last_working_day')}
      />
      <Field label="Reason *" value={f.reason} onChangeText={set('reason')} />
      <Field label="Description" value={f.description} onChangeText={set('description')} multiline />
    </Card>
  );
}

function TerminationFields({ f, set }) {
  const immediate = f.notice_mode === 'Immediate (misconduct)';
  return (
    <>
      <Card style={{ gap: 12 }}>
        <Select label="Termination type *" value={f.type} options={opts(TERMINATION_TYPES)} onChange={set('type')} />
        <Field label="Reason *" value={f.reason} onChangeText={set('reason')} />
        <Field label="Description" value={f.description} onChangeText={set('description')} multiline />
        <DateField label="Incident date" value={f.incident_date} onChange={set('incident_date')} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Select label="Notice" value={f.notice_mode} options={opts(NOTICE_MODES)} onChange={set('notice_mode')} />
        {immediate ? null : (
          <Field label="Notice days" value={f.notice_days} onChangeText={set('notice_days')} keyboardType="numeric" />
        )}
        <DateField label="Last working day" value={f.last_working_day} onChange={set('last_working_day')} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Check label="Show-cause notice issued" value={f.show_cause_issued} onChange={set('show_cause_issued')} />
        <DateField label="Hearing date" value={f.hearing_date} onChange={set('hearing_date')} />
        <Field label="Employee response" value={f.employee_response} onChangeText={set('employee_response')} multiline />
        <Check label="Legal review required" value={f.legal_review} onChange={set('legal_review')} />
        <Check label="Gratuity forfeited" value={f.gratuity_forfeited} onChange={set('gratuity_forfeited')} />
        <Check label="Assets recovered" value={f.assets_recovered} onChange={set('assets_recovered')} />
        <Check label="Access revoked" value={f.access_revoked} onChange={set('access_revoked')} />
      </Card>
    </>
  );
}

function WarningFields({ f, set }) {
  return (
    <>
      <Card style={{ gap: 12 }}>
        <Select label="Warning type *" value={f.type} options={opts(WARNING_TYPES)} onChange={set('type')} />
        <Select
          label="Severity *"
          value={f.severity}
          options={opts(WARNING_SEVERITIES)}
          onChange={(v) => {
            set('severity')(v);
            set('pip_linked')(v !== 'Level 1');
          }}
        />
        <Select label="Category *" value={f.category} options={opts(WARNING_CATEGORIES)} onChange={set('category')} />
        <DateField label="Incident date *" value={f.incident_date} onChange={set('incident_date')} />
        <Field label="Description *" value={f.description} onChangeText={set('description')} multiline />
      </Card>
      <Card style={{ gap: 12 }}>
        <Field label="Improvement plan" value={f.improvement_plan} onChangeText={set('improvement_plan')} multiline />
        <DateField label="Review date" value={f.review_date} onChange={set('review_date')} />
        <Field
          label="Valid for (months)"
          value={f.validity_months}
          onChangeText={set('validity_months')}
          keyboardType="numeric"
        />
        <Check label="Linked to a PIP" value={f.pip_linked} onChange={set('pip_linked')} />
        <DateField label="Issued on *" value={f.issued_on} onChange={set('issued_on')} />
        <Field label="Letter reference" value={f.letter_ref} onChangeText={set('letter_ref')} />
      </Card>
    </>
  );
}

function InsuranceFields({ f, set }) {
  const c = useColors();
  const deps = f.dependents;
  const setDep = (i, key) => (v) => set('dependents')(deps.map((d, j) => (j === i ? { ...d, [key]: v } : d)));
  return (
    <>
      <Card style={{ gap: 12 }}>
        <Field label="Policy number *" value={f.policy_number} onChangeText={set('policy_number')} autoCapitalize="characters" />
        <Field label="Insurer *" value={f.insurer_name} onChangeText={set('insurer_name')} />
        <Field label="Plan type *" value={f.plan_type} onChangeText={set('plan_type')} placeholder="e.g. Group Health" />
        <Field label="Sum insured (₹) *" value={f.coverage_amount} onChangeText={set('coverage_amount')} keyboardType="numeric" />
        <DateField label="Start date *" value={f.start_date} onChange={set('start_date')} />
        <DateField label="Expiry date *" value={f.expiry_date} onChange={set('expiry_date')} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Text style={{ color: c.text, fontWeight: '700' }}>Dependents</Text>
        {deps.length === 0 ? <Muted>No dependents added.</Muted> : null}
        {deps.map((d, i) => (
          <View key={i} style={{ gap: 8, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12 }}>
            <Field label={`Dependent ${i + 1} name`} value={d.name} onChangeText={setDep(i, 'name')} />
            <Select label="Relation" value={d.relation} options={opts(DEPENDENT_RELATIONS)} onChange={setDep(i, 'relation')} />
            <Button title="Remove" variant="outline" onPress={() => set('dependents')(deps.filter((_, j) => j !== i))} />
          </View>
        ))}
        <Button
          title="Add dependent"
          variant="outline"
          onPress={() => set('dependents')([...deps, { name: '', relation: DEPENDENT_RELATIONS[0] }])}
        />
      </Card>
    </>
  );
}

function RetirementFields({ f, set }) {
  return (
    <Card style={{ gap: 12 }}>
      <DateField label="Retirement date *" value={f.retired_on} onChange={set('retired_on')} />
      <Select label="Reason" value={f.reason} options={opts(RETIREMENT_REASONS)} onChange={set('reason')} />
      <Check label="Gratuity eligible" value={f.gratuity_eligible} onChange={set('gratuity_eligible')} />
      {f.gratuity_eligible ? (
        <Field label="Gratuity amount (₹)" value={f.gratuity_amount} onChangeText={set('gratuity_amount')} keyboardType="numeric" />
      ) : null}
      <Check label="Re-engage on contract" value={f.re_engage_contract} onChange={set('re_engage_contract')} />
      {f.re_engage_contract ? (
        <>
          <Field label="Extension (months)" value={f.extension_months} onChangeText={set('extension_months')} keyboardType="numeric" />
          <Field label="Extension CTC (₹)" value={f.extension_ctc} onChangeText={set('extension_ctc')} keyboardType="numeric" />
        </>
      ) : null}
      <Field label="Remarks" value={f.remarks} onChangeText={set('remarks')} multiline />
    </Card>
  );
}

const FIELDS = {
  transfers: TransferFields,
  resignations: ResignationFields,
  terminations: TerminationFields,
  warnings: WarningFields,
  insurance: InsuranceFields,
  retirements: RetirementFields,
};

/** Create a lifecycle case: POST /cases/{type} with the *Create schema body. */
export default function NewAdminCaseScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { type } = useLocalSearchParams();
  const cfg = caseTypeOf(type);
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit');
  const [empSearch, setEmpSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [form, setForm] = useState(() => ({ ...(INITIAL[String(type)] ?? {}) }));
  const [error, setError] = useState('');
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const employees = useQuery({
    queryKey: ['admin', 'employees', 'picker', empSearch.trim()],
    queryFn: () => getEmployees({ limit: 50, search: empSearch.trim() }),
    enabled: !!cfg,
  });
  const details = useQuery({
    queryKey: ['admin', 'cases', 'employee', employeeId],
    queryFn: () => getEmployeeById(employeeId),
    enabled: !!employeeId,
  });
  const listed = (employees.data?.items ?? []).find((e) => String(e.id) === employeeId);
  const emp = details.data ?? listed;
  const empOptions = (employees.data?.items ?? []).map((e) => ({
    value: String(e.id),
    label: [personName(e), e.employee_code ?? e.employee_id].filter(Boolean).join(' · '),
  }));
  if (listed && !empOptions.some((o) => o.value === employeeId))
    empOptions.unshift({ value: employeeId, label: personName(listed) });

  const submit = useMutation({
    mutationFn: (body) => createCase(cfg.key, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cases', cfg.key] });
      Alert.alert(cfg.singular, `${cfg.singular} recorded.`);
      router.back();
    },
    onError: (e) => setError(errorMessage(e, `Could not save the ${cfg.singular.toLowerCase()}.`)),
  });

  if (!cfg)
    return (
      <View style={{ flex: 1 }}>
        <Header title="New case" />
        <Muted style={{ padding: 16 }}>Unknown case type.</Muted>
      </View>
    );
  if (!canEdit)
    return (
      <View style={{ flex: 1 }}>
        <Header title={`New ${cfg.singular.toLowerCase()}`} />
        <Muted style={{ padding: 16 }}>You do not have permission to create {cfg.title.toLowerCase()}.</Muted>
      </View>
    );

  const Fields = FIELDS[cfg.key];
  const onSubmit = () => {
    const { body, error: err } = buildBody(cfg.key, employeeId, form);
    if (err) return setError(err);
    setError('');
    submit.mutate(body);
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={`New ${cfg.singular.toLowerCase()}`} />
      <Page>
        <Card style={{ gap: 12 }}>
          <Field label="Find employee" value={empSearch} onChangeText={setEmpSearch} placeholder="Name or code" />
          <Select
            label="Employee *"
            value={employeeId}
            options={empOptions}
            onChange={setEmployeeId}
            placeholder={employees.isLoading ? 'Loading employees…' : 'Select employee'}
          />
          {employees.error ? <ErrorText>{errorMessage(employees.error, 'Could not load employees.')}</ErrorText> : null}
          {emp ? (
            <View>
              <Row label="Department" value={emp.department_name ?? emp.department} />
              <Row label="Designation" value={emp.designation_name ?? emp.designation} />
              <Row label="Status" value={emp.status ?? emp.employment_status} />
            </View>
          ) : null}
        </Card>
        {cfg.key === 'transfers' ? (
          <TransferFields f={form} set={set} companyId={emp?.company_id} />
        ) : (
          <Fields f={form} set={set} />
        )}
        <ErrorText>{error}</ErrorText>
        <Button title={`Save ${cfg.singular.toLowerCase()}`} onPress={onSubmit} loading={submit.isPending} />
      </Page>
    </View>
  );
}
