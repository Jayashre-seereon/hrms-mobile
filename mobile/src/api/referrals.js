import { api } from '@/lib/api';
/** Same endpoints as the web app (src/api/referralApi.js — employee self-service /me/referrals). */
const unwrap = (data) => data?.data ?? data;
export const REFERRAL_RELATIONS = [
  'Ex-colleague',
  'Friend',
  'Family',
  'College batchmate',
  'Community / meetup',
  'Former client / vendor',
];
export async function getMyReferrals({ page = 1, pageSize = 50, search } = {}) {
  const params = { page, pageSize };
  if (search) params.search = search;
  const res = unwrap((await api.get('/me/referrals', { params })).data);
  const items = Array.isArray(res) ? res : (res?.items ?? []);
  return { items, stats: res?.stats ?? null };
}
export const submitReferral = async (payload) => unwrap((await api.post('/me/referrals', payload)).data);
export const getMyReferralDetail = async (id) =>
  unwrap((await api.get(`/me/referrals/${encodeURIComponent(id)}`)).data);
export async function getOpenPosts() {
  const res = unwrap((await api.get('/recruitment/open-posts')).data);
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}
/* ---------------- HR admin (web: referralApi.js "HR ADMIN ENDPOINTS", features/employees/components/ReferralsTab.jsx) ---------------- */
export const REFERRAL_STATUSES = ['Submitted', 'Screening', 'Interviewing', 'Hired', 'Bonus paid', 'Not selected'];
/** Statuses HR may set with PATCH /referrals/{id}/status (backend rejects any other value). */
export const REFERRAL_STATUS_UPDATES = ['Screening', 'Interviewing', 'Hired', 'Not selected'];
/** GET /referrals?page&pageSize&status&jobId&search → { items, total, page, pageSize } */
export async function getAdminReferrals({ page = 1, pageSize = 100, status, jobId, search } = {}) {
  const params = { page, pageSize };
  if (status && status !== 'all') params.status = status;
  if (jobId && jobId !== 'all') params.jobId = jobId;
  if (search) params.search = search;
  const res = unwrap((await api.get('/referrals', { params })).data);
  const items = Array.isArray(res) ? res : (res?.items ?? []);
  return { items, total: res?.total ?? items.length };
}
/**
 * POST /referrals — HR logs a referral on behalf of an employee.
 * { referrerId, candidateName, email, phone, relationship, jobId, jobTitle, skills, experienceYears, note,
 *   bonusEligible, bonusAmount }
 */
export const createReferralOnBehalf = async (payload) => unwrap((await api.post('/referrals', payload)).data);
/** GET /referrals/meta → { statuses, relationships } */
export const getReferralMeta = async () => unwrap((await api.get('/referrals/meta')).data);
/** GET /referrals/{id} — detail with ats_stage, interview details and audit `history`. */
export const getAdminReferralDetail = async (id) =>
  unwrap((await api.get(`/referrals/${encodeURIComponent(id)}`)).data);
/** PATCH /referrals/{id}/status  body { status } */
export const updateReferralStatus = async (id, status) =>
  unwrap((await api.patch(`/referrals/${encodeURIComponent(id)}/status`, { status })).data);
/** POST /referrals/{id}/pay-bonus  body { remarks } — backend enforces Hired + 90-day retention. */
export const payReferralBonus = async (id, remarks = '') =>
  unwrap(
    (await api.post(`/referrals/${encodeURIComponent(id)}/pay-bonus`, { remarks: remarks?.trim() || undefined }))
      .data,
  );
/** Same 90-day retention rule the web shows before allowing "Pay bonus" (counted from hire / creation date). */
export function retentionOf(r = {}) {
  const dateStr = r.hiredOn || r.hired_on || r.createdOn || r.created_on;
  if (!dateStr) return { elapsed: 0, remaining: 90, eligible: false };
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const remaining = Math.max(0, 90 - diffDays);
  return { elapsed: diffDays, remaining, eligible: remaining === 0 };
}
