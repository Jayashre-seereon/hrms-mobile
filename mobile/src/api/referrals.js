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
