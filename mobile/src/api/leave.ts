import { api } from '@/lib/api';

/**
 * Leave — same endpoints and field mapping as the web app:
 *  - src/api/leave_request.js + features/leave/data/leaveRequestAdapter.js   (employee requests, /leave-requests)
 *  - src/api/leaveApi.js                                                      (balances, validation, /leave)
 *  - src/api/leave_approval.js + features/leave/data/leaveApprovalAdapter.js (manager / HR approvals)
 */

const PAGE_SIZE = 100;
const clean = (v: unknown) => String(v ?? '').trim();

const unwrap = (data: any) => (data?.data != null ? data.data : data);

function readItems(data: any): any[] {
  const d = unwrap(data);
  if (Array.isArray(d)) return d;
  for (const key of ['items', 'results', 'applications', 'leave_types', 'reason_categories', 'team_members']) {
    if (Array.isArray(d?.[key])) return d[key];
  }
  return [];
}

const statusLabel = (s: unknown) => {
  const v = clean(s).toLowerCase();
  return v ? v[0].toUpperCase() + v.slice(1) : '';
};

const optionName = (o: any): string =>
  typeof o === 'string' ? o : (o?.label ?? o?.name ?? o?.value ?? o?.full_name ?? '');

export type LeaveRequest = {
  id: string;
  apiId: string | number;
  leaveType: string;
  from: string;
  to: string;
  days: number;
  dayPart: string;
  reasonCategory: string;
  description: string;
  contactDuringLeave: string;
  locationDuringLeave: string;
  handoverTo: string;
  handoverNotes: string;
  appliedOn: string;
  status: string;
  decisionReason: string;
  decidedBy: string;
  decidedOn: string;
  documents: string[];
  canCancel: boolean;
};

export function leaveFromApi(r: any = {}): LeaveRequest {
  const docs = Array.isArray(r.supporting_documents) ? r.supporting_documents : [];
  return {
    id: r.request_id ?? String(r.id ?? ''),
    apiId: r.id ?? r.request_id,
    leaveType: r.leave_type?.name ?? r.leave_type ?? '',
    from: r.from_date ?? '',
    to: r.to_date ?? '',
    days: Number(r.days ?? 0),
    dayPart: r.day_part_label ?? r.day_part ?? '',
    reasonCategory: r.reason_category?.label ?? r.reason_category?.value ?? r.reason_category ?? '',
    description: r.description ?? '',
    contactDuringLeave: r.contact_during_leave ?? '',
    locationDuringLeave: r.location_during_leave ?? '',
    handoverTo: r.handover_to?.name ?? r.handover_to ?? '',
    handoverNotes: r.handover_notes ?? '',
    appliedOn: r.applied_on ?? '',
    status: statusLabel(r.status),
    decisionReason: r.decision_reason ?? '',
    decidedBy: r.decided_by?.name ?? r.decided_by ?? '',
    decidedOn: r.decided_on ?? '',
    documents: docs.map((d: any) => d?.document_name ?? d?.name ?? '').filter(Boolean),
    canCancel: Boolean(r.actions?.can_cancel),
  };
}

/** GET /leave-requests — the logged-in employee's own requests. */
export async function listMyLeaveRequests(): Promise<LeaveRequest[]> {
  const { data } = await api.get('/leave-requests', { params: { page: 1, page_size: PAGE_SIZE } });
  return readItems(data)
    .filter((r) => r && typeof r === 'object')
    .map(leaveFromApi);
}

/** GET /leave-requests/{id} */
export async function getMyLeaveRequest(id: string | number): Promise<LeaveRequest> {
  const { data } = await api.get(`/leave-requests/${encodeURIComponent(String(id))}`);
  return leaveFromApi(unwrap(data));
}

/** POST /leave-requests/{id}/withdraw  body { remarks } — only a Pending request can be withdrawn. */
export async function withdrawLeaveRequest(id: string | number, remarks: string) {
  const { data } = await api.post(`/leave-requests/${encodeURIComponent(String(id))}/withdraw`, {
    remarks: clean(remarks),
  });
  return leaveFromApi(unwrap(data));
}

export type LeaveType = {
  id: string;
  name: string;
  code: string;
  paid: boolean | null;
  annual: number | null;
  leaveBalance: number | null;
  maxConsecutive: number;
  attachmentAfterDays: number;
  active?: boolean;
};

/** GET /leave-requests/leave-types — active leave types the company admin created. */
export async function loadEmployeeLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await api.get('/leave-requests/leave-types', {
    params: { active: true, page: 1, page_size: 100 },
  });
  const seen = new Set<string>();
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  return readItems(data)
    .map((o: any): LeaveType => {
      if (typeof o === 'string') {
        return { id: clean(o), name: clean(o), code: '', paid: null, annual: null, leaveBalance: null, maxConsecutive: 0, attachmentAfterDays: 0, active: true };
      }
      const annual = num(o?.annual_days ?? o?.annual);
      const balance = num(o?.leave_balance);
      const maxConsecutive = Number(o?.max_consecutive);
      const attachAfter = Number(o?.attachment_after_days);
      return {
        id: clean(o?.id ?? o?.code ?? optionName(o)),
        name: clean(optionName(o)),
        code: clean(o?.code),
        paid: o?.paid_leave ?? o?.paid ?? null,
        annual: Number.isFinite(annual) ? annual : null,
        leaveBalance: Number.isFinite(balance) ? balance : null,
        maxConsecutive: Number.isFinite(maxConsecutive) ? maxConsecutive : 0,
        attachmentAfterDays: Number.isFinite(attachAfter) ? attachAfter : 0,
        active: o?.active,
      };
    })
    .filter((t) => {
      if (!t.name || t.active === false) return false;
      const key = t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** GET /leave-requests/reason-categories */
export async function loadReasonCategories(): Promise<{ value: string; label: string }[]> {
  const { data } = await api.get('/leave-requests/reason-categories');
  return readItems(data)
    .map((o: any) =>
      typeof o === 'string'
        ? { value: clean(o), label: clean(o) }
        : { value: clean(o?.value ?? o?.code ?? o?.name ?? o?.label), label: clean(o?.label ?? o?.name ?? o?.value) },
    )
    .filter((o) => o.value && o.label);
}

/** GET /leave-requests/team-members — people for "Handover to". */
export async function loadTeamMembers(): Promise<{ id: string; name: string; designation: string }[]> {
  const { data } = await api.get('/leave-requests/team-members');
  return readItems(data)
    .map((o: any) =>
      typeof o === 'string'
        ? { id: o, name: clean(o), designation: '' }
        : {
            id: String(o?.id ?? o?.employee_id ?? o?.value ?? optionName(o)),
            name: clean(o?.name ?? o?.full_name ?? o?.label ?? ''),
            designation: o?.designation ?? '',
          },
    )
    .filter((o) => o.name);
}

/** GET /leave/balances/me — per-type lines (type / leave_type / code, entitled|total, used, pending, available). */
export async function getMyBalances(year?: number): Promise<any[]> {
  const { data } = await api.get('/leave/balances/me', { params: year ? { year } : {} });
  const d = data?.data ?? data;
  return Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
}

export const DAY_PARTS = ['Full day', 'First half', 'Second half'] as const;

const DAY_PART_API: Record<string, string> = {
  'full day': 'FULL_DAY',
  'first half': 'FIRST_HALF',
  'second half': 'SECOND_HALF',
};
export const dayPartToApi = (v: string) => DAY_PART_API[clean(v).toLowerCase()] ?? 'FULL_DAY';

/** POST /leave/applications/validate — live check while the form is filled ({ ok, errors, warnings, days }). */
export async function validateApplication(payload: {
  leave_type: string;
  from_date: string;
  to_date: string;
  day_part: string;
  documents?: unknown[];
}): Promise<{ ok?: boolean; errors?: string[]; warnings?: string[]; days?: number } | null> {
  const { data } = await api.post('/leave/applications/validate', { documents: [], ...payload });
  const body = data?.data ?? data;
  return body && typeof body === 'object' && 'ok' in body ? body : null;
}

export type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };

export type ApplyForm = {
  leaveType: string;
  from: string;
  to: string;
  dayPart: string;
  reasonCategory: string;
  description: string;
  contactDuringLeave?: string;
  locationDuringLeave?: string;
  handoverTo?: string;
  handoverNotes?: string;
};

/** POST /leave-requests (multipart/form-data), same fields as the web form. */
export async function applyForLeave(form: ApplyForm, files: PickedFile[] = []) {
  const fd = new FormData();
  fd.append('leave_type', clean(form.leaveType));
  fd.append('from_date', form.from);
  fd.append('to_date', form.to);
  fd.append('day_part', dayPartToApi(form.dayPart));
  fd.append('reason_category', clean(form.reasonCategory));
  fd.append('description', clean(form.description));
  if (clean(form.contactDuringLeave)) fd.append('contact_during_leave', clean(form.contactDuringLeave));
  if (clean(form.locationDuringLeave)) fd.append('location_during_leave', clean(form.locationDuringLeave));
  if (clean(form.handoverTo)) fd.append('handover_to_employee', clean(form.handoverTo));
  if (clean(form.handoverNotes)) fd.append('handover_notes', clean(form.handoverNotes));
  files.forEach((f) => {
    // React Native FormData file part.
    fd.append('supporting_documents', { uri: f.uri, name: f.name, type: f.mimeType || 'application/octet-stream' } as any);
  });
  const { data } = await api.post('/leave-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return leaveFromApi(unwrap(data));
}

/* ------------------------------ Approvals ------------------------------ */

export type ApprovalLevel = 'manager' | 'hr';

export type LeaveApproval = {
  id: string;
  apiId: string | number;
  employee: string;
  empCode: string;
  department: string;
  designation: string;
  leaveType: string;
  from: string;
  to: string;
  days: number;
  available: number | null;
  description: string;
  documents: string[];
  status: string;
  statusLabel: string;
  stage: string;
  level: ApprovalLevel;
  statusNote: string;
  decisionReason: string;
  decidedOn: string;
  appliedOn: string;
  canApprove: boolean;
  canReject: boolean;
  actionMessage: string;
};

const APPROVAL_BASE: Record<ApprovalLevel, string> = { manager: '/leave-approvals', hr: '/hr-leave-approvals' };

export function approvalFromApi(r: any = {}, level: ApprovalLevel = 'manager'): LeaveApproval {
  const attachments = Array.isArray(r.attachments) ? r.attachments : [];
  return {
    id: r.reference ?? String(r.id ?? ''),
    apiId: r.id ?? r.reference,
    employee: r.employee?.name ?? '',
    empCode: r.employee?.employee_code ?? '',
    department: r.employee?.department ?? '',
    designation: r.employee?.designation ?? '',
    leaveType: r.leave_type ?? '',
    from: r.from_date ?? '',
    to: r.to_date ?? '',
    days: Number(r.days ?? 0),
    available: Number.isFinite(Number(r.available)) && r.available !== null ? Number(r.available) : null,
    description: r.description ?? '',
    documents: attachments.map((a: any) => a?.document_name).filter(Boolean),
    status: r.status ?? '',
    statusLabel: r.status_label ?? '',
    stage: r.stage ?? '',
    level,
    statusNote: r.status_note ?? '',
    decisionReason: r.decision_reason ?? '',
    decidedOn: r.decided_on ? String(r.decided_on).slice(0, 10) : '',
    appliedOn: r.applied_on ?? '',
    canApprove: Boolean(r.actions?.can_approve),
    canReject: Boolean(r.actions?.can_reject),
    actionMessage: r.actions?.message ?? '',
  };
}

/**
 * Requests the user reviews from both steps (manager: /leave-approvals, HR Manager: /hr-leave-approvals).
 * A 403 from one list just means the user does not hold that step.
 */
export async function listLeaveApprovals(params: Record<string, unknown> = {}): Promise<LeaveApproval[]> {
  const query = { status: 'All', page: 1, page_size: PAGE_SIZE, ...params };
  const [mgr, hr] = await Promise.allSettled([
    api.get(APPROVAL_BASE.manager, { params: query }),
    api.get(APPROVAL_BASE.hr, { params: query }),
  ]);
  const denied = (r: PromiseSettledResult<any>) => r.status === 'rejected' && r.reason?.response?.status === 403;
  if (mgr.status === 'rejected' && hr.status === 'rejected') {
    if (denied(mgr) && denied(hr)) return [];
    throw (denied(mgr) ? (hr as PromiseRejectedResult) : mgr).reason;
  }

  const rows = new Map<string, LeaveApproval>();
  const add = (result: PromiseSettledResult<any>, level: ApprovalLevel) => {
    if (result.status !== 'fulfilled') return;
    const body = result.value.data;
    const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
    items
      .filter((r: any) => r && typeof r === 'object')
      .map((r: any) => approvalFromApi(r, level))
      // The HR step only handles what the manager already approved.
      .filter((row: LeaveApproval) => !(level === 'hr' && row.status === 'Pending' && row.stage === 'manager'))
      .forEach((row: LeaveApproval) => {
        const key = String(row.apiId ?? row.id);
        const seen = rows.get(key);
        if (!seen || (!seen.canApprove && row.canApprove)) rows.set(key, row);
      });
  };
  add(mgr, 'manager');
  add(hr, 'hr');

  return [...rows.values()].sort(
    (a, b) => String(b.appliedOn).localeCompare(String(a.appliedOn)) || String(b.id).localeCompare(String(a.id)),
  );
}

/** POST {manager|hr base}/{id}/approve | /reject   body { remarks } — on the step the row belongs to. */
export async function decideLeaveApproval(row: LeaveApproval, action: 'approve' | 'reject', remarks = '') {
  const base = APPROVAL_BASE[row.level];
  const { data } = await api.post(`${base}/${encodeURIComponent(String(row.apiId ?? row.id))}/${action}`, {
    remarks: clean(remarks),
  });
  return approvalFromApi(data, row.level);
}
