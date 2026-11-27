/**
 * Leave types, pay grades, awards, onboarding documents, performance and assessment / evaluation masters.
 * Payloads mirror the web adapters exactly:
 * - features/leave/data/leaveMasterAdapters.js + organization/components/ConfigHubTabs.jsx (leave types)
 * - organization/views/MastersView.jsx (pay grades, awards via MasterTable, onboarding documents)
 * - recruitment/data/onboarding_document_adapter.js
 * - performance/data/performanceIndicatorAdapter.js + performance/components/PerformanceMasters.jsx
 * - recruitment/data/recruitmentMasterAdapters.js (assessment + evaluation parameters)
 * Holiday calendars and branches have dedicated screens (href).
 */
import { findPerformanceCategoryId } from '@/api/admin/masters-extra';

import type { MasterConfig } from './registry';
import { nameError } from './validation';

const t = (v: unknown) => String(v ?? '').trim();
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const STATUSES = ['Active', 'Inactive'];

// ---------- leave types ----------
const LEAVE_BOOLEANS = ['encashable_at_year_end', 'clubbable', 'paid_leave', 'active'] as const;

const leaveTypes: MasterConfig = {
  key: 'leave-types',
  title: 'Leave types',
  singular: 'Leave type',
  group: 'Leave & holidays',
  endpoint: '/leave-types',
  listParams: { page: 1, page_size: 100 },
  module: 'leave',
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [
    [r.code, `${n(r.annual_days)} days`, r.credit].filter(Boolean).join(' · '),
    [r.approval_chain && `Approval: ${r.approval_chain}`, r.applicable_to && `For: ${r.applicable_to}`].filter(Boolean).join(' · '),
    r.paid_leave === false ? 'Unpaid' : 'Paid',
  ],
  statusOf: (r) => (r.active === false ? 'Inactive' : 'Active'),
  fields: [
    { key: 'name', label: 'Name', required: true, validate: (v) => nameError(v, 'Leave name') },
    { key: 'code', label: 'Code', disabled: true, placeholder: 'Auto-generated on save' },
    { key: 'annual_days', label: 'Leave balance', type: 'number' },
    { key: 'credit', label: 'Credit', type: 'select', optionsFrom: { endpoint: '/leave-types/credits', labelKey: 'name', names: true } },
    {
      key: 'approval_chain',
      label: 'Approval chain',
      type: 'select',
      optionsFrom: { endpoint: '/leave-types/approval-chains', labelKey: 'name', names: true },
    },
    { key: 'max_consecutive', label: 'Max consecutive (0 = none)', type: 'number' },
    { key: 'validity_days', label: 'Validity days (comp-off)', type: 'number' },
    { key: 'max_carry_forward', label: 'Max carry-forward', type: 'number' },
    { key: 'encash_on', label: 'Encash on', type: 'select', options: ['Gross', 'Basic'] },
    { key: 'applicable_to', label: 'Applicable to' },
    { key: 'encashable_at_year_end', label: 'Encashable at year end', type: 'boolean' },
    { key: 'clubbable', label: 'Clubbable with holidays / other leave', type: 'boolean' },
    { key: 'paid_leave', label: 'Paid leave', type: 'boolean' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  // New leave type: same defaults as the web "+ Leave type" button.
  toForm: (r) =>
    r
      ? {
          name: r.name ?? '',
          code: r.code ?? '',
          annual_days: String(n(r.annual_days)),
          credit: r.credit ?? '',
          approval_chain: r.approval_chain ?? '',
          max_consecutive: String(n(r.max_consecutive)),
          validity_days: String(n(r.validity_days)),
          max_carry_forward: String(n(r.max_carry_forward)),
          attachment_after_days: n(r.attachment_after_days), // not on the form (web keeps it too)
          encash_on: r.encash_on || 'Gross',
          applicable_to: r.applicable_to || 'All',
          encashable_at_year_end: Boolean(r.encashable_at_year_end),
          clubbable: Boolean(r.clubbable),
          paid_leave: r.paid_leave !== false,
          active: r.active !== false,
        }
      : {
          name: '',
          code: '',
          annual_days: '',
          credit: 'Quarterly pro-rata',
          approval_chain: 'Manager',
          max_consecutive: '0',
          validity_days: '0',
          max_carry_forward: '0',
          attachment_after_days: 0,
          encash_on: 'Gross',
          applicable_to: 'All',
          encashable_at_year_end: false,
          clubbable: true,
          paid_leave: true,
          active: true,
        },
  // leaveMasterAdapters.toPayload: empty code is never sent (server generates LT-001); leave_balance = annual.
  toPayload: (v) => {
    const body: Record<string, any> = {
      name: t(v.name),
      ...(t(v.code) ? { code: t(v.code) } : {}),
      annual_days: n(v.annual_days),
      credit: t(v.credit),
      approval_chain: t(v.approval_chain),
      max_consecutive: n(v.max_consecutive),
      validity_days: n(v.validity_days),
      attachment_after_days: n(v.attachment_after_days),
      max_carry_forward: n(v.max_carry_forward),
      encash_on: t(v.encash_on) || 'Gross',
      applicable_to: t(v.applicable_to) || 'All',
    };
    LEAVE_BOOLEANS.forEach((k) => (body[k] = Boolean(v[k])));
    body.leave_balance = n(v.annual_days);
    return body;
  },
  // Web saves an edit as PATCH with only the changed fields; code is never edited; leave_balance follows annual_days.
  updateMethod: 'patch-changed',
  patchSkip: ['code'],
  canDelete: true,
  // The server refuses to delete a type employees already have balances / requests for → offer to deactivate.
  deleteFallback: {
    match: /deactivate/i,
    label: 'Deactivate',
    message: 'This leave type is in use. Deactivate it instead? Employees will no longer see or apply for it.',
    body: { active: false },
  },
};

// ---------- pay grades ----------
const PAY_BANDS = ['Entry Level', 'Individual Contributor', 'Senior IC', 'People Manager', 'Management', 'Executive / Leadership'];

const payGrades: MasterConfig = {
  key: 'pay-grades',
  title: 'Pay grades',
  singular: 'Pay grade',
  group: 'Payroll',
  endpoint: '/pay-grades',
  module: 'payroll',
  titleOf: (r) => r.grade_code ?? '',
  subtitleOf: (r) => [r.band, `${r.currency ?? 'INR'} ${r.minimum_ctc ?? '—'} – ${r.maximum_ctc ?? '—'}`, r.description],
  statusOf: (r) => r.status ?? 'Active',
  fields: [
    { key: 'grade_code', label: 'Grade code', required: true, placeholder: 'e.g. G4', unique: true },
    { key: 'band', label: 'Band', type: 'select', options: PAY_BANDS, required: true },
    { key: 'minimum_ctc', label: 'Minimum CTC', type: 'number', required: true },
    { key: 'maximum_ctc', label: 'Maximum CTC', type: 'number', required: true },
    { key: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'AED', 'GBP'], defaultValue: 'INR' },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, defaultValue: 'Active' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  toForm: (r) => ({
    grade_code: r.grade_code ?? '',
    band: r.band ?? '',
    minimum_ctc: String(r.minimum_ctc ?? ''),
    maximum_ctc: String(r.maximum_ctc ?? ''),
    currency: r.currency ?? 'INR',
    status: r.status ?? 'Active',
    description: r.description ?? '',
  }),
  toPayload: (v) => ({
    grade_code: t(v.grade_code),
    band: v.band,
    minimum_ctc: Number(v.minimum_ctc),
    maximum_ctc: Number(v.maximum_ctc),
    currency: v.currency || 'INR',
    status: v.status || 'Active',
    description: v.description || '',
  }),
  updateMethod: 'patch-changed',
  canDelete: true,
};

// ---------- awards (MasterTable: name + description) ----------
const awards: MasterConfig = {
  key: 'awards',
  title: 'Awards',
  singular: 'Award',
  group: 'Recognition',
  endpoint: '/awards',
  listKeys: ['awards', 'data'],
  module: 'organization',
  idOf: (r) => r.id ?? r.award_id,
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [r.code, r.description],
  fields: [
    { key: 'name', label: 'Name', required: true, unique: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  toPayload: (v) => ({ name: t(v.name), description: t(v.description) }),
  updateMethod: 'patch-single-else-put',
  canDelete: true,
};

// ---------- onboarding documents (MasterTable withRequired; API is_mandatory, server code DOC-001) ----------
const onboardingDocuments: MasterConfig = {
  key: 'onboarding-documents',
  title: 'Onboarding documents',
  singular: 'Document',
  group: 'Recruitment',
  endpoint: '/onboarding/documents',
  listParams: { page: 1, page_size: 100 },
  listKeys: ['documents', 'data'],
  module: 'recruitment',
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [r.code, r.description],
  statusOf: (r) => ((r.is_mandatory ?? r.required) ? 'Mandatory' : null),
  fields: [
    { key: 'name', label: 'Name', required: true, unique: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'required', label: 'Mandatory — employees must upload this during onboarding', type: 'boolean' },
  ],
  toForm: (r) => ({ name: r.name ?? '', description: r.description ?? '', required: Boolean(r.is_mandatory ?? r.required) }),
  toPayload: (v) => ({ name: t(v.name), description: t(v.description), is_mandatory: Boolean(v.required) }),
  updateMethod: 'patch-single-else-put',
  canDelete: true,
};

// ---------- performance (PerformanceMasters.jsx) ----------
const INDICATOR_CATEGORIES = ['Productivity', 'Quality', 'Collaboration', 'Leadership', 'Customer'];
const MEASUREMENT_UNITS = ['Number', 'Percentage', 'Hours', 'Score (1-5)', 'Currency'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annual'];

const nameStatusDesc = (extra: Pick<MasterConfig, 'key' | 'title' | 'singular' | 'endpoint'> & Partial<MasterConfig>): MasterConfig => ({
  group: 'Performance',
  module: 'performance',
  listParams: { page: 1, page_size: 100 },
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [r.code, r.description],
  statusOf: (r) => r.status,
  fields: [
    { key: 'name', label: 'Name', required: true },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, required: true, defaultValue: 'Active' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  toPayload: (v) => ({ name: t(v.name), status: t(v.status), description: t(v.description) }),
  canDelete: true,
  ...extra,
});

const performanceIndicators: MasterConfig = {
  key: 'performance-indicators',
  title: 'Performance indicators',
  singular: 'Indicator',
  group: 'Performance',
  endpoint: '/performance-indicators',
  listParams: { page: 1, page_size: 100 },
  module: 'performance',
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [
    [r.code, r.category_name ?? r.category].filter(Boolean).join(' · '),
    `Target ${r.target_value ?? '—'} ${r.measurement_unit ?? ''}`.trim(),
    r.description,
  ],
  statusOf: (r) => r.status,
  fields: [
    { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Sprint Velocity' },
    { key: 'category', label: 'Category', type: 'select', options: INDICATOR_CATEGORIES, required: true },
    { key: 'measurement_unit', label: 'Measurement Unit', type: 'select', options: MEASUREMENT_UNITS, required: true },
    {
      key: 'target_value',
      label: 'Target Value',
      required: true,
      placeholder: 'e.g. 38',
      validate: (v) => (t(v) === '' || !Number.isFinite(Number(t(v))) ? 'Target Value must be a number, e.g. 38.' : ''),
    },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, required: true, defaultValue: 'Active' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  toForm: (r) => ({
    name: r.name ?? '',
    category: r.category_name ?? r.category ?? '',
    measurement_unit: r.measurement_unit ?? '',
    target_value: r.target_value == null ? '' : String(r.target_value),
    status: r.status ?? '',
    description: r.description ?? '',
  }),
  toPayload: (v) => ({
    name: t(v.name),
    category: t(v.category),
    measurement_unit: t(v.measurement_unit),
    target_value: Number(t(v.target_value)),
    status: t(v.status),
    description: t(v.description),
  }),
  // category_id looked up from /performance-indicators/categories; sent without it when the lookup fails.
  beforeSave: async (p) => {
    const id = await findPerformanceCategoryId(p.category);
    return id ? { ...p, category_id: id } : p;
  },
  canDelete: true,
};

// ---------- assessment parameters (recruitment scorecard) ----------
const ALL_ROLES = 'All roles';
const ASSESSMENT_GROUPS = ['Technical', 'Behavioural', 'Aptitude', 'Attitude', 'Communication', 'Leadership', 'Domain', 'Culture fit'];
const parseScale = (s: unknown) => {
  const v = Number(String(s ?? '').split(/[-–]/).pop());
  return Number.isFinite(v) && v > 0 ? v : 10;
};

const assessmentParameters: MasterConfig = {
  key: 'assessment-parameters',
  title: 'Assessment parameters',
  singular: 'Parameter',
  group: 'Recruitment',
  endpoint: '/recruitment/assessment-parameters',
  listParams: { page: 1, page_size: 200 },
  module: 'recruitment',
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [
    [r.code, r.group, `${Number(r.weight ?? 0)} %`, `1–${parseScale(r.scale)}`].filter(Boolean).join(' · '),
    (Array.isArray(r.applies_to) ? r.applies_to : []).join(', ') || null,
    r.mandatory ? 'Mandatory' : null,
  ],
  statusOf: (r) => ((r.is_active ?? true) ? 'Active' : 'Inactive'),
  listNote: (rows) =>
    `Used in the recruitment scorecard; weights must total 100 % (currently ${rows
      .filter((r) => r.is_active ?? true)
      .reduce((s, r) => s + Number(r.weight ?? 0), 0)} %).`,
  fields: [
    { key: 'name', label: 'Name', required: true },
    { key: 'group', label: 'Group', type: 'select', options: ASSESSMENT_GROUPS },
    { key: 'weight', label: 'Weight %', type: 'number' },
    { key: 'scale', label: 'Scale', type: 'select', options: [{ label: '1–5', value: '5' }, { label: '1–10', value: '10' }] },
    { key: 'applies_to', label: 'Applies to (comma-separated job families)' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'mandatory', label: 'Mandatory', type: 'boolean' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  toForm: (r) =>
    r
      ? {
          name: r.name ?? '',
          group: r.group ?? '',
          weight: String(Number(r.weight ?? 0)),
          scale: String(parseScale(r.scale)),
          applies_to: (Array.isArray(r.applies_to) ? r.applies_to : []).filter((x: string) => x !== ALL_ROLES).join(', '),
          description: r.description ?? '',
          mandatory: Boolean(r.mandatory),
          active: r.is_active ?? true,
        }
      : { name: '', group: 'Technical', weight: '10', scale: '10', applies_to: '', description: '', mandatory: false, active: true },
  toPayload: (v) => {
    const appliesTo = t(v.applies_to)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      name: t(v.name),
      group: v.group,
      weight: Number(v.weight),
      scale: `1-${Number(v.scale)}`,
      applies_to: appliesTo.length ? appliesTo : [ALL_ROLES],
      description: t(v.description),
      mandatory: Boolean(v.mandatory),
      is_active: Boolean(v.active),
    };
  },
  statusToggle: { suffix: '/status', field: 'is_active', isActive: (r) => r.is_active ?? true },
  canDelete: true,
};

// ---------- evaluation parameters (no DELETE endpoint) ----------
const evaluationParameters: MasterConfig = {
  key: 'evaluation-parameters',
  title: 'Evaluation parameters',
  singular: 'Parameter',
  group: 'Performance',
  endpoint: '/performance/evaluation-parameters',
  listParams: { page: 1, page_size: 100 },
  module: 'performance',
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [
    [r.description, Array.isArray(r.for_roles) ? r.for_roles.join(', ') : r.for_roles].filter(Boolean).join(' · '),
    `${Number(r.weight ?? 0)} %`,
  ],
  statusOf: (r) => ((r.is_active ?? true) ? 'Active' : 'Inactive'),
  fields: [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'weight', label: 'Weight %', type: 'number' },
    { key: 'for_roles', label: 'For roles' },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  toForm: (r) =>
    r
      ? {
          name: r.name ?? '',
          description: r.description ?? '',
          weight: String(Number(r.weight ?? 0)),
          for_roles: Array.isArray(r.for_roles) ? r.for_roles.join(', ') : String(r.for_roles ?? 'All'),
          active: r.is_active ?? true,
        }
      : { name: '', description: '', weight: '10', for_roles: 'All', active: true },
  toPayload: (v) => {
    const roles = t(v.for_roles)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      name: t(v.name),
      description: t(v.description),
      weight: Number(v.weight),
      for_roles: roles.length ? roles : ['All'],
      is_active: Boolean(v.active),
    };
  },
  statusToggle: { suffix: '/status', field: 'is_active', isActive: (r) => r.is_active ?? true },
  canDelete: false,
};

// New items use the same toForm with no row (defaults like the web "+ Add" buttons).
leaveTypes.newForm = () => leaveTypes.toForm!(null);
assessmentParameters.newForm = () => assessmentParameters.toForm!(null);
evaluationParameters.newForm = () => evaluationParameters.toForm!(null);

// ---------- dedicated screens ----------
const holidayCalendars: MasterConfig = {
  key: 'holiday-calendars',
  title: 'Holiday calendars',
  singular: 'Holiday calendar',
  group: 'Leave & holidays',
  endpoint: '/attendance/holiday-calendars',
  module: 'attendance',
  href: '/admin/masters/holiday-calendars',
  titleOf: (r) => r.holiday_title ?? '',
  fields: [],
};

const branches: MasterConfig = {
  key: 'branches',
  title: 'Branches',
  singular: 'Branch',
  group: 'Organisation',
  endpoint: '/super-admin/branches',
  module: 'organization',
  href: '/admin/masters/branches',
  titleOf: (r) => r.name ?? '',
  fields: [],
};

export const EXTRA_MASTERS: MasterConfig[] = [
  branches,
  leaveTypes,
  holidayCalendars,
  payGrades,
  performanceIndicators,
  nameStatusDesc({ key: 'indicator-categories', title: 'Indicator categories', singular: 'Category', endpoint: '/performance/indicator-categories' }),
  nameStatusDesc({
    key: 'goal-types',
    title: 'Goal types',
    singular: 'Goal type',
    endpoint: '/performance/goal-types',
    updateMethod: 'patch-changed',
  }),
  nameStatusDesc({
    key: 'review-cycles',
    title: 'Review cycles',
    singular: 'Review cycle',
    endpoint: '/performance/review-cycles',
    subtitleOf: (r) => [r.code, r.frequency, r.description],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'frequency', label: 'Frequency', type: 'select', options: FREQUENCIES, required: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUSES, required: true, defaultValue: 'Active' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    toPayload: (v) => ({ name: t(v.name), frequency: t(v.frequency), status: t(v.status), description: t(v.description) }),
    updateMethod: 'patch-changed',
  }),
  evaluationParameters,
  assessmentParameters,
  onboardingDocuments,
  awards,
];
