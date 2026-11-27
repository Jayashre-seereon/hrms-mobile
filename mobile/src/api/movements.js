import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { rowsOf } from '@/api/admin/common';
import { api } from '@/lib/api';
/**
 * Movements / promotions — same endpoints and bodies as the web app
 * (src/services/api/endpoints/promotions.js; employee: features/employees/views/MyMovementsView.jsx,
 * HR: features/employees/components/PromotionsTab.jsx).
 */
const BASE = '/cases/promotions';
const enc = (v) => encodeURIComponent(String(v));
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
/** Files: [{ uri, name, type }] (expo-document-picker assets) → FormData with repeated "files" parts. */
function filesForm(files) {
  const form = new FormData();
  files.forEach((f) => form.append('files', { uri: f.uri, name: f.name, type: f.type || 'application/octet-stream' }));
  return form;
}

/* ---------------- Employee self-service ---------------- */
export async function getMyMovements() {
  const { data } = await api.get('/emp/movements');
  return data ?? {};
}
export const acknowledgeMyPromotion = async (id) => (await api.post(`/emp/promotions/${enc(id)}/acknowledge`, {})).data;
export const queryMyPromotion = async (id, body) => (await api.post(`/emp/promotions/${enc(id)}/queries`, body)).data;
/** POST /cases/promotions/{id}/query-attachments (employee). Returns { attachments: [{ name, url, content_type }] }. */
export async function uploadQueryAttachments(id, files) {
  return (await api.post(`${BASE}/${enc(id)}/query-attachments`, filesForm(files), multipart)).data;
}

/* ---------------- HR (employee.edit) ---------------- */
export const money = (v) => (v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);
export const employeeName = (e) =>
  [e?.first_name, e?.last_name].filter(Boolean).join(' ') || e?.full_name || 'Employee';
/** GET /cases/promotions?employee_id&status — every promotion in the caller's scope (plain array). */
export async function listPromotions(params = {}) {
  const { data } = await api.get(BASE, { params });
  return Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
}
/**
 * POST /cases/promotions — issue a promotion directly to the employee (no approval step). Body as the web form:
 * { employee_id, purpose, appraisal_ref, basis, from_designation, to_designation, from_grade, to_grade, from_ctc,
 *   to_ctc, effective_from, letter_type, letter_ref, letter_file_url, letter_body, new_department,
 *   internal_remarks, attachments }
 */
export const createPromotion = async (body) => (await api.post(BASE, body)).data;
/** POST /cases/promotions/issue-attachments?employee_id= — supporting files sent with a new promotion. */
export async function uploadPromotionIssueAttachments(employeeId, files) {
  return (
    await api.post(`${BASE}/issue-attachments`, filesForm(files), { ...multipart, params: { employee_id: employeeId } })
  ).data;
}
/** POST /cases/promotions/{id}/query-reply-attachments — files attached to HR's reply. */
export async function uploadQueryReplyAttachments(id, files) {
  return (await api.post(`${BASE}/${enc(id)}/query-reply-attachments`, filesForm(files), multipart)).data;
}
/** POST /cases/promotions/{id}/queries/reply  body { reply, resolve, attachments } */
export const replyPromotionQuery = async (id, body) => (await api.post(`${BASE}/${enc(id)}/queries/reply`, body)).data;
/** PUT /cases/promotions/{id}/revision — edit and reissue (revision + 1). */
export const revisePromotion = async (id, body) => (await api.put(`${BASE}/${enc(id)}/revision`, body)).data;
/** POST /cases/promotions/{id}/cancel  body { reason } */
export const cancelPromotion = async (id, reason) => (await api.post(`${BASE}/${enc(id)}/cancel`, { reason })).data;
/** POST /cases/promotions/{id}/letter/resend — after the employee accepted / once effective. */
export const resendPromotionLetter = async (id) => (await api.post(`${BASE}/${enc(id)}/letter/resend`, {})).data;

/* Option lists of the web "Issue a promotion" form (same queries as PromotionsTab.jsx). */
export const PROMOTION_PURPOSES = [
  'Annual Appraisal Outcome',
  'Performance Based',
  'Career Progression',
  'Role / Responsibility Change',
  'Special Promotion',
  'Other',
];
export const PROMOTION_STATUSES = [
  'DRAFT',
  'SENT_TO_EMPLOYEE',
  'QUERY_RAISED',
  'QUERY_RESOLVED',
  'SCHEDULED',
  'EFFECTIVE',
  'CANCELLED',
];
/** GET /super-admin/designations?company_id&is_active=true&page_size=200 */
export async function listPromotionDesignations(companyId) {
  const { data } = await api.get('/super-admin/designations', {
    params: { company_id: companyId, is_active: true, page_size: 200 },
  });
  return rowsOf(data);
}
/** GET /pay-grades?organization_id&status=Active&page_size=100 → [{ grade_code, band, minimum_ctc, maximum_ctc }] */
export async function listPromotionPayGrades(organizationId) {
  const { data } = await api.get('/pay-grades', {
    params: { organization_id: organizationId, status: 'Active', page_size: 100 },
  });
  return rowsOf(data);
}
/** GET /super-admin/departments?company_id&is_active=true&page_size=200 */
export async function listPromotionDepartments(companyId) {
  const { data } = await api.get('/super-admin/departments', {
    params: { company_id: companyId, is_active: true, page_size: 200 },
  });
  return rowsOf(data).filter((d) => d?.is_active !== false);
}

/* ---------------- Attachments (both sides) ---------------- */
/** Files HR attached when issuing (history entries with action "ISSUED"). */
export const issuedAttachments = (p = {}) =>
  (Array.isArray(p.history) ? p.history : []).flatMap((h) =>
    h?.action === 'ISSUED' && Array.isArray(h?.details?.attachments) ? h.details.attachments : [],
  );
const safe = (s) => String(s ?? 'file').replace(/[^\w.-]+/g, '_');
const mimeOf = (name, fallback) => {
  const n = String(name).toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  return fallback || 'application/octet-stream';
};
/**
 * GET /cases/promotions/{id}/query-attachments/{name}?url= — downloads a query / issue attachment with the
 * signed-in session and opens the share sheet (web: openQueryAttachment downloads the blob).
 */
export async function openPromotionAttachment(id, attachment) {
  const res = await api.get(`${BASE}/${enc(id)}/query-attachments/${enc(attachment.name)}`, {
    params: { url: attachment.url },
    responseType: 'arraybuffer',
    timeout: 120000,
  });
  const file = new File(Paths.cache, safe(attachment.name));
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(res.data));
  const mimeType = mimeOf(attachment.name, attachment.content_type);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: attachment.name });
  }
  return file.uri;
}
/**
 * Picks PDF / PNG / JPG files for promotion attachments (backend limit: 5 files, 5 MB each) and merges them with
 * the ones already picked. Returns the new list of { uri, name, type, size }.
 */
export async function pickPromotionFiles(current = []) {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/png', 'image/jpeg'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return current;
  const picked = res.assets
    .filter((a) => !a.size || a.size <= 5 * 1024 * 1024)
    .map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size }));
  const merged = [...current, ...picked.filter((f) => !current.some((c) => c.name === f.name && c.size === f.size))];
  if (picked.length < res.assets.length || merged.length > 5)
    Alert.alert('Attachments', 'Up to 5 files, 5 MB each (PDF, PNG, JPG). Some files were skipped.');
  return merged.slice(0, 5);
}
