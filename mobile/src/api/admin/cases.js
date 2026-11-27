import { api } from '@/lib/api';
import { clean, personName, rowsOf, unwrap } from './common';
import { getEmployees } from './employees';

/**
 * Employee lifecycle cases — backend app/api/v1/cases.py (prefix /cases, module "employee").
 * Bodies follow app/schemas/lifecycle.py exactly (TransferCreate, ResignationCreate, TerminationCreate,
 * WarningCreate, InsuranceCreate, RetirementCreate and the *Decision / *StatusUpdate schemas).
 * List endpoints accept only `status` (case-insensitive exact match) and `employee_id`; rows come back
 * newest first, already scoped to the caller (admins: org / company / branch; others: their own records).
 * Responses carry `employee_id` only — no employee name.
 */

/** Per case type: endpoint, labels, known status values (schema Field descriptions / model defaults). */
export const CASE_TYPES = {
  transfers: {
    key: 'transfers',
    title: 'Transfers',
    singular: 'Transfer',
    icon: 'swap-horizontal-outline',
    hint: 'Branch, department, manager or role moves',
    statuses: ['Pending approval', 'Approved', 'Effective', 'Rejected'],
    // PUT /cases/transfers/{id}/decision  { decision, note }
    action: 'decision',
    actionValues: ['Approved', 'Effective', 'Rejected'],
    finalStatuses: ['Effective', 'Rejected'],
  },
  resignations: {
    key: 'resignations',
    title: 'Resignations',
    singular: 'Resignation',
    icon: 'exit-outline',
    hint: 'Submitted resignations and HR decisions',
    statuses: ['Pending', 'Approved', 'Rejected', 'Withdrawn'],
    // PUT /cases/resignations/{id}/decision  { decision, approved_last_working_day, remarks }
    action: 'decision',
    actionValues: ['Approved', 'Rejected', 'Withdrawn'],
    finalStatuses: ['Rejected', 'Withdrawn'],
  },
  terminations: {
    key: 'terminations',
    title: 'Terminations',
    singular: 'Termination',
    icon: 'close-circle-outline',
    hint: 'Separation cases, notice and approvals',
    statuses: ['Pending approval', 'Approved', 'Effective', 'Rejected'],
    // PUT /cases/terminations/{id}/decision  { decision, remarks }
    action: 'decision',
    actionValues: ['Approved', 'Effective', 'Rejected'],
    finalStatuses: ['Effective', 'Rejected'],
  },
  warnings: {
    key: 'warnings',
    title: 'Warnings',
    singular: 'Warning',
    icon: 'warning-outline',
    hint: 'Disciplinary warning letters',
    statuses: ['Effective'],
    action: null,
    actionValues: [],
    finalStatuses: [],
  },
  insurance: {
    key: 'insurance',
    title: 'Insurance',
    singular: 'Insurance policy',
    icon: 'shield-checkmark-outline',
    hint: 'Employee insurance policies',
    statuses: ['Active'],
    action: null,
    actionValues: [],
    finalStatuses: [],
  },
  retirements: {
    key: 'retirements',
    title: 'Retirements',
    singular: 'Retirement',
    icon: 'hourglass-outline',
    hint: 'Scheduled retirements, gratuity and extensions',
    statuses: ['Scheduled', 'Processed', 'Completed'],
    // PUT /cases/retirements/{id}/status  { status, remarks }
    action: 'status',
    actionValues: ['Scheduled', 'Processed', 'Completed'],
    finalStatuses: ['Completed'],
  },
};

export const CASE_TYPE_KEYS = Object.keys(CASE_TYPES);
export const caseTypeOf = (key) => CASE_TYPES[String(key)] ?? null;

/** Option lists — web labels (hrms-frontenddev employees data) for free-text `str` schema fields. */
export const TRANSFER_TYPES = ['Branch', 'Department', 'Reporting manager', 'Project / client', 'Role'];
export const TRANSFER_REQUESTED_BY = ['HR', 'Employee', 'Manager', 'Management'];
export const TERMINATION_TYPES = [
  'Misconduct',
  'Performance (post-PIP)',
  'Absconding / abandonment',
  'Redundancy / restructuring',
  'Contract end',
  'Probation not confirmed',
  'Breach of policy / integrity',
  'Medical incapacity',
];
export const NOTICE_MODES = ['Immediate (misconduct)', 'Serve notice', 'Pay in lieu'];
export const WARNING_TYPES = [
  'Attendance',
  'Performance',
  'Conduct / behaviour',
  'Policy violation',
  'Data / IT security',
  'Client complaint',
  'Insubordination',
  'Safety',
];
export const WARNING_SEVERITIES = ['Level 1', 'Level 2', 'Level 3 (final)'];
export const WARNING_CATEGORIES = [
  'Late arrival / unplanned absence',
  'Missed deliverables',
  'Unprofessional communication',
  'Dress code / discipline',
  'Unauthorised data sharing',
  'Repeated timesheet non-compliance',
  'Client escalation',
  'Refusal of reasonable instruction',
  'Other',
];
export const DEPENDENT_RELATIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Other'];
export const RETIREMENT_REASONS = ['Superannuation', 'Voluntary retirement', 'Medical'];

const path = (type) => {
  if (!CASE_TYPES[type]) throw new Error(`Unknown case type: ${type}`);
  return `/cases/${type}`;
};

/** GET /cases/{type}?status=&employee_id= → plain array. */
export async function listCases(type, { status, employeeId } = {}) {
  const { data } = await api.get(path(type), { params: clean({ status, employee_id: employeeId }) });
  return rowsOf(data);
}

/** POST /cases/{type} — body already shaped to the *Create schema; empty strings / nulls are dropped. */
export async function createCase(type, body) {
  const payload = Object.fromEntries(
    Object.entries(body ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
  const { data } = await api.post(path(type), payload);
  return unwrap(data);
}

/** PUT /cases/transfers/{id}/decision — { decision: 'Approved' | 'Effective' | 'Rejected', note? } */
export async function decideTransfer(id, { decision, note }) {
  const { data } = await api.put(`/cases/transfers/${encodeURIComponent(id)}/decision`, {
    decision,
    note: note?.trim() || null,
  });
  return unwrap(data);
}

/** PUT /cases/resignations/{id}/decision — { decision, approved_last_working_day?, remarks? } */
export async function decideResignation(id, { decision, approvedLastWorkingDay, remarks }) {
  const { data } = await api.put(`/cases/resignations/${encodeURIComponent(id)}/decision`, {
    decision,
    approved_last_working_day: approvedLastWorkingDay || null,
    remarks: remarks?.trim() || null,
  });
  return unwrap(data);
}

/** PUT /cases/terminations/{id}/decision — { decision: 'Approved' | 'Effective' | 'Rejected', remarks? } */
export async function decideTermination(id, { decision, remarks }) {
  const { data } = await api.put(`/cases/terminations/${encodeURIComponent(id)}/decision`, {
    decision,
    remarks: remarks?.trim() || null,
  });
  return unwrap(data);
}

/** PUT /cases/retirements/{id}/status — { status: 'Scheduled' | 'Processed' | 'Completed', remarks? } */
export async function updateRetirementStatus(id, { status, remarks }) {
  const { data } = await api.put(`/cases/retirements/${encodeURIComponent(id)}/status`, {
    status,
    remarks: remarks?.trim() || null,
  });
  return unwrap(data);
}

/** What the server does on each action (the hooks in cases.py) — shown before confirming. */
export function actionEffect(type, value) {
  const v = String(value ?? '').toLowerCase();
  if (type === 'transfers' && v === 'effective')
    return "The employee's branch, department, manager, company and designation are updated to the new values.";
  if (type === 'resignations' && v === 'approved') return 'The employee is moved to notice period.';
  if (type === 'terminations' && (v === 'approved' || v === 'effective'))
    return "The employee is marked Exited, deactivated and their login account is disabled.";
  if (type === 'retirements' && (v === 'processed' || v === 'completed'))
    return 'The employee is marked Retired and deactivated.';
  return '';
}

/** Short one-line summary of a row for list cards. */
export function caseSummary(type, r = {}) {
  switch (type) {
    case 'transfers':
      return [r.type && `${r.type} transfer`, r.new_designation && `→ ${r.new_designation}`].filter(Boolean).join(' ');
    case 'resignations':
      return r.reason;
    case 'terminations':
      return [r.type, r.reason].filter(Boolean).join(' · ');
    case 'warnings':
      return [r.severity, r.type, r.category].filter(Boolean).join(' · ');
    case 'insurance':
      return [r.insurer_name, r.plan_type, r.policy_number].filter(Boolean).join(' · ');
    case 'retirements':
      return r.reason;
    default:
      return '';
  }
}

/** The main date of a row for list cards: [label, value]. */
export function caseDate(type, r = {}) {
  switch (type) {
    case 'transfers':
      return ['Effective', r.effective_from];
    case 'resignations':
      return ['Last day', r.approved_last_working_day || r.requested_last_working_day];
    case 'terminations':
      return ['Last day', r.last_working_day];
    case 'warnings':
      return ['Issued', r.issued_on];
    case 'insurance':
      return ['Expires', r.expiry_date];
    case 'retirements':
      return ['Retires', r.retired_on];
    default:
      return ['', null];
  }
}

/**
 * Employee id → { name, code } for the first 100 employees in scope (GET /employees, limit max 100), used to label
 * case rows (the case responses only carry employee_id). Detail screens fall back to GET /employees/{id}.
 */
export async function getEmployeeLookup() {
  const { items } = await getEmployees({ limit: 100 });
  const map = {};
  items.forEach((e) => {
    map[String(e.id)] = { name: personName(e), code: e.employee_code ?? e.employee_id ?? '' };
  });
  return map;
}

export const employeeLabel = (lookup, id) => {
  const e = lookup?.[String(id)];
  if (!e) return id ? `Employee ${String(id).slice(0, 8)}` : 'Employee';
  return [e.name || 'Employee', e.code].filter(Boolean).join(' · ');
};
