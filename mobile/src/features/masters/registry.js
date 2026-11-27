/**
 * Master data registry — one entry per master. The screens in app/(app)/admin/masters are generic:
 * they read this config for the endpoint, list text and form fields.
 *
 * Field names / payloads mirror the web adapters:
 * - organization/{Grade,Category,Section}.jsx (SimpleMasterPage: `{ [fieldKey]: value }`)
 * - api/departmentApi.js, features/recruitment/data/recruitmentMasterAdapters.js,
 *   api/{job_type,candidate_source,interview_type,onboarding_checklist}.js,
 *   features/exit/data/terminationTypeAdapter.js, features/assets/data/assetMasterAdapter.js
 */
import { EXTRA_MASTERS } from './extra-masters';
const STATUSES = ['Active', 'Inactive'];
const t = (v) => String(v ?? '').trim();
const toApiTime = (v) => (/^\d{2}:\d{2}$/.test(t(v)) ? `${t(v)}:00` : t(v));
const fromApiTime = (v) => (v ? String(v).slice(0, 5) : '');
/** name / description / status masters (recruitment + exit). */
const nameDescStatus = (extra) => ({
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [r.code, r.description],
  statusOf: (r) => r.status,
  listParams: { page: 1, page_size: 100 },
  fields: [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: STATUSES, defaultValue: 'Active' },
  ],
  toPayload: (v) => ({ name: t(v.name), description: t(v.description), status: v.status || 'Active' }),
  canDelete: true,
  ...extra,
});
/** name / description masters without status (termination, warning, complaint types). */
const nameDesc = (extra) => ({
  group: 'Exit & cases',
  module: 'exit',
  titleOf: (r) => r.name ?? '',
  subtitleOf: (r) => [r.code, r.description],
  listParams: { page: 1, page_size: 100 },
  fields: [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  toPayload: (v) => ({ name: t(v.name), description: t(v.description) }),
  canDelete: true,
  ...extra,
});
const BASE_MASTERS = [
  // ---------- Organisation ----------
  {
    key: 'department-grades',
    title: 'Department grades',
    singular: 'Grade',
    group: 'Organisation',
    endpoint: '/department-grades',
    module: 'organization',
    titleOf: (r) => r.grade_code ?? r.name ?? '',
    fields: [{ key: 'grade_code', label: 'Grade code', required: true, placeholder: 'e.g. GRD01', uppercase: true }],
    canDelete: true,
  },
  {
    key: 'department-categories',
    title: 'Department categories',
    singular: 'Category',
    group: 'Organisation',
    endpoint: '/department-categories',
    module: 'organization',
    titleOf: (r) => r.category_name ?? r.name ?? '',
    fields: [{ key: 'category_name', label: 'Category type', required: true, placeholder: 'e.g. Managerial' }],
    canDelete: true,
  },
  {
    key: 'department-sections',
    title: 'Department sections',
    singular: 'Section',
    group: 'Organisation',
    endpoint: '/department-sections',
    module: 'organization',
    titleOf: (r) => r.section_name ?? r.name ?? '',
    subtitleOf: (r) => [r.section_code],
    fields: [
      { key: 'section_name', label: 'Section name', required: true },
      { key: 'section_code', label: 'Section code', required: true, uppercase: true },
    ],
    canDelete: true,
  },
  {
    key: 'departments',
    title: 'Departments',
    singular: 'Department',
    group: 'Organisation',
    endpoint: '/departments',
    module: 'organization',
    titleOf: (r) => r.department_name ?? r.name ?? '',
    subtitleOf: (r) => [
      r.department_code,
      [r.category_name ?? r.category?.category_name, r.section_name ?? r.section?.section_name]
        .filter(Boolean)
        .join(' · '),
    ],
    fields: [
      { key: 'department_name', label: 'Department name', required: true },
      { key: 'department_code', label: 'Department code', required: true, uppercase: true },
      {
        key: 'grade_id',
        label: 'Grade',
        type: 'select',
        required: true,
        optionsFrom: { endpoint: '/department-grades', labelKey: 'grade_code' },
      },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        required: true,
        optionsFrom: { endpoint: '/department-categories', labelKey: 'category_name' },
      },
      {
        key: 'section_id',
        label: 'Section',
        type: 'select',
        required: true,
        optionsFrom: { endpoint: '/department-sections', labelKey: 'section_name' },
      },
    ],
    toForm: (r) => ({
      department_name: r.department_name ?? '',
      department_code: r.department_code ?? '',
      grade_id: String(r.grade_id ?? r.grade?.id ?? ''),
      category_id: String(r.category_id ?? r.category?.id ?? ''),
      section_id: String(r.section_name_id ?? r.section_code_id ?? r.section_id ?? r.section?.id ?? ''),
    }),
    // The web form picks one section; the API takes it twice (section_code_id / section_name_id).
    toPayload: (v) => ({
      department_name: t(v.department_name),
      department_code: t(v.department_code).toUpperCase(),
      grade_id: v.grade_id,
      category_id: v.category_id,
      section_code_id: v.section_id,
      section_name_id: v.section_id,
    }),
    canDelete: true,
  },
  {
    key: 'designations',
    title: 'Designations',
    singular: 'Designation',
    group: 'Organisation',
    endpoint: '/super-admin/designations',
    module: 'organization',
    titleOf: (r) => r.designation_name ?? r.name ?? '',
    subtitleOf: (r) => [r.designation_code, r.department_name],
    fields: [],
    readOnly: true, // web only lists + imports designations
  },
  // ---------- Attendance ----------
  {
    key: 'shifts',
    title: 'Shifts',
    singular: 'Shift',
    group: 'Attendance',
    endpoint: '/attendance/shifts',
    listParams: { page: 1, page_size: 100 },
    module: 'attendance',
    titleOf: (r) => r.shift_name ?? r.name ?? '',
    subtitleOf: (r) => [
      `${fromApiTime(r.start_time)} – ${fromApiTime(r.end_time)}`,
      r.office_name,
      r.assigned_employees_count != null ? `${r.assigned_employees_count} employees` : null,
    ],
    fields: [
      { key: 'shift_name', label: 'Shift name', required: true },
      {
        key: 'office_name',
        label: 'Office',
        type: 'select',
        optionsFrom: {
          endpoint: '/attendance/shifts/offices/dropdown',
          labelKey: 'office_name',
          valueKey: 'office_name',
        },
      },
      { key: 'start_time', label: 'Start time', type: 'time', required: true },
      { key: 'end_time', label: 'End time', type: 'time', required: true },
      { key: 'break_time_enabled', label: 'Break time', type: 'boolean', defaultValue: false },
      { key: 'break_start_time', label: 'Break start', type: 'time', showIf: (v) => !!v.break_time_enabled },
      { key: 'break_end_time', label: 'Break end', type: 'time', showIf: (v) => !!v.break_time_enabled },
    ],
    toForm: (r) => ({
      shift_name: r.shift_name ?? '',
      office_name: r.office_name ?? '',
      start_time: fromApiTime(r.start_time),
      end_time: fromApiTime(r.end_time),
      break_time_enabled: Boolean(r.break_time_enabled),
      break_start_time: fromApiTime(r.break_start_time),
      break_end_time: fromApiTime(r.break_end_time),
    }),
    toPayload: (v) => ({
      shift_name: t(v.shift_name),
      office_name: t(v.office_name),
      start_time: toApiTime(v.start_time),
      end_time: toApiTime(v.end_time),
      break_time_enabled: Boolean(v.break_time_enabled),
      ...(v.break_time_enabled
        ? { break_start_time: toApiTime(v.break_start_time), break_end_time: toApiTime(v.break_end_time) }
        : {}),
      is_active: true,
    }),
    canDelete: true,
  },
  // ---------- Recruitment ----------
  nameDescStatus({
    key: 'job-types',
    title: 'Job types',
    singular: 'Job type',
    group: 'Recruitment',
    endpoint: '/recruitment/job-types',
    module: 'recruitment',
  }),
  nameDescStatus({
    key: 'candidate-sources',
    title: 'Candidate sources',
    singular: 'Candidate source',
    group: 'Recruitment',
    endpoint: '/recruitment/candidate-sources',
    module: 'recruitment',
  }),
  nameDescStatus({
    key: 'interview-types',
    title: 'Interview types',
    singular: 'Interview type',
    group: 'Recruitment',
    endpoint: '/recruitment/interview-types',
    module: 'recruitment',
  }),
  nameDescStatus({
    key: 'interview-rounds',
    title: 'Interview rounds',
    singular: 'Interview round',
    group: 'Recruitment',
    endpoint: '/recruitment/interview-rounds',
    module: 'recruitment',
    subtitleOf: (r) => [r.code, r.job_name, r.description],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'job_name', label: 'Job' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: STATUSES, defaultValue: 'Active' },
    ],
    toPayload: (v) => ({
      name: t(v.name),
      job_name: t(v.job_name),
      status: v.status || 'Active',
      description: t(v.description),
    }),
  }),
  nameDescStatus({
    key: 'job-locations',
    title: 'Job locations',
    singular: 'Job location',
    group: 'Recruitment',
    endpoint: '/recruitment/job-locations',
    module: 'recruitment',
    subtitleOf: (r) => [
      r.code,
      [r.city, r.state, r.country].filter(Boolean).join(', '),
      r.remote_work ? `Remote: ${r.remote_work}` : null,
    ],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'country', label: 'Country' },
      { key: 'postal_code', label: 'Postal code' },
      {
        key: 'remote_work',
        label: 'Remote work',
        type: 'select',
        options: ['No', 'Yes', 'Hybrid'],
        defaultValue: 'No',
      },
      { key: 'status', label: 'Status', type: 'select', options: STATUSES, defaultValue: 'Active' },
    ],
    toPayload: (v) => ({
      name: t(v.name),
      address: t(v.address),
      city: t(v.city),
      state: t(v.state),
      country: t(v.country),
      postal_code: t(v.postal_code),
      remote_work: v.remote_work || 'No',
      status: v.status || 'Active',
    }),
  }),
  nameDescStatus({
    key: 'onboarding-checklists',
    title: 'Onboarding checklists',
    singular: 'Checklist',
    group: 'Recruitment',
    endpoint: '/recruitment/onboarding-checklists',
    module: 'recruitment',
    titleOf: (r) => r.checklist_name ?? r.name ?? '',
    subtitleOf: (r) => [Array.isArray(r.items) ? r.items.join(', ') : r.items, r.description],
    fields: [
      { key: 'checklist_name', label: 'Checklist name', required: true },
      { key: 'items', label: 'Items (comma separated)', type: 'textarea' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: STATUSES, defaultValue: 'Active' },
    ],
    toForm: (r) => ({
      checklist_name: r.checklist_name ?? r.name ?? '',
      items: Array.isArray(r.items) ? r.items.join(', ') : (r.items ?? ''),
      description: r.description ?? '',
      status: r.status ?? 'Active',
    }),
    toPayload: (v) => ({
      checklist_name: t(v.checklist_name),
      items: t(v.items)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      description: t(v.description),
      status: v.status || 'Active',
    }),
  }),
  // ---------- Exit & cases ----------
  nameDesc({
    key: 'termination-types',
    title: 'Termination types',
    singular: 'Termination type',
    endpoint: '/termination-types',
  }),
  nameDesc({ key: 'warning-types', title: 'Warning types', singular: 'Warning type', endpoint: '/warning-types' }),
  nameDesc({
    key: 'complaint-types',
    title: 'Complaint types',
    singular: 'Complaint type',
    endpoint: '/complaint-types',
  }),
  // ---------- Assets ----------
  {
    key: 'asset-types',
    title: 'Asset types',
    singular: 'Asset type',
    group: 'Assets',
    endpoint: '/assets/asset-types',
    module: 'assets',
    titleOf: (r) => r.type_name ?? r.name ?? '',
    subtitleOf: (r) => [r.code, r.category, r.custodian_department],
    statusOf: (r) => (r.is_active === false ? 'Inactive' : 'Active'),
    fields: [
      { key: 'code', label: 'Code', required: true, uppercase: true },
      { key: 'type_name', label: 'Type name', required: true },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        optionsFrom: { endpoint: '/assets/asset-types/categories', labelKey: 'name', valueKey: 'name' },
      },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'useful_life_years', label: 'Useful life (years)', type: 'number', defaultValue: '1' },
      { key: 'depreciation_percentage', label: 'Depreciation %', type: 'number', defaultValue: '0' },
      { key: 'custodian_department', label: 'Custodian department' },
      { key: 'default_return_period_days', label: 'Default return period (days)', type: 'number', defaultValue: '0' },
      { key: 'serial_number_required', label: 'Serial number required', type: 'boolean', defaultValue: false },
      { key: 'is_active', label: 'Active', type: 'boolean', defaultValue: true },
    ],
    toForm: (r) => ({
      code: r.code ?? '',
      type_name: r.type_name ?? '',
      category: r.category ?? '',
      description: r.description ?? '',
      useful_life_years: String(r.useful_life_years ?? 1),
      depreciation_percentage: String(r.depreciation_percentage ?? 0),
      custodian_department: r.custodian_department ?? '',
      default_return_period_days: String(r.default_return_period_days ?? 0),
      serial_number_required: Boolean(r.serial_number_required),
      is_active: r.is_active ?? true,
      // kept so an edit does not wipe them (not editable on mobile)
      condition_checklist: r.condition_checklist ?? [],
      default_accessories: r.default_accessories ?? [],
    }),
    toPayload: (v) => ({
      code: t(v.code).toUpperCase(),
      type_name: t(v.type_name),
      category: v.category,
      description: t(v.description),
      useful_life_years: Number(v.useful_life_years) || 0,
      depreciation_percentage: Number(v.depreciation_percentage) || 0,
      custodian_department: t(v.custodian_department),
      default_return_period_days: Number(v.default_return_period_days) || 0,
      serial_number_required: Boolean(v.serial_number_required),
      is_active: Boolean(v.is_active),
      condition_checklist: v.condition_checklist ?? [],
      default_accessories: v.default_accessories ?? [],
    }),
    canDelete: true,
  },
];
export const MASTERS = [...BASE_MASTERS, ...EXTRA_MASTERS];
export const MASTER_GROUPS = [
  'Organisation',
  'Leave & holidays',
  'Attendance',
  'Payroll',
  'Performance',
  'Recruitment',
  'Exit & cases',
  'Assets',
  'Recognition',
];
export const rowId = (m, row) => String(m.idOf ? m.idOf(row) : row?.id);
export const getMaster = (key) => MASTERS.find((m) => m.key === key);
/** Default form values for a master (new item, or from an existing row). */
export function formValues(m, row) {
  if (row && m.toForm) return m.toForm(row);
  if (!row && m.newForm) return m.newForm();
  return Object.fromEntries(
    m.fields.map((f) => {
      const v = row?.[f.key];
      if (f.type === 'boolean') return [f.key, row ? Boolean(v) : Boolean(f.defaultValue)];
      return [f.key, v != null ? String(v) : (f.defaultValue ?? '')];
    }),
  );
}
/** Request body for a master. */
export function payloadOf(m, values) {
  if (m.toPayload) return m.toPayload(values);
  return Object.fromEntries(
    m.fields
      .filter((f) => !f.showIf || f.showIf(values))
      .map((f) => {
        const v = values[f.key];
        if (f.type === 'boolean') return [f.key, Boolean(v)];
        if (f.type === 'number') return [f.key, Number(v) || 0];
        const s = t(v);
        return [f.key, f.uppercase ? s.toUpperCase() : s];
      }),
  );
}
