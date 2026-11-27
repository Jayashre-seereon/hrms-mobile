import { api } from '@/lib/api';

/** Same endpoints as the web app (src/api/referralApi.js — employee self-service /me/referrals). */
const unwrap = (data: any) => data?.data ?? data;

export const REFERRAL_RELATIONS = [
  'Ex-colleague',
  'Friend',
  'Family',
  'College batchmate',
  'Community / meetup',
  'Former client / vendor',
];

export type Referral = Record<string, any>;
export type ReferralStats = { referralsMade?: number; inPipeline?: number; hired?: number; totalBonusReceived?: number };

export async function getMyReferrals({ page = 1, pageSize = 50, search }: { page?: number; pageSize?: number; search?: string } = {}) {
  const params: Record<string, unknown> = { page, pageSize };
  if (search) params.search = search;
  const res = unwrap((await api.get('/me/referrals', { params })).data);
  const items: Referral[] = Array.isArray(res) ? res : (res?.items ?? []);
  return { items, stats: (res?.stats ?? null) as ReferralStats | null };
}

export type NewReferral = {
  candidateName: string;
  email: string;
  phone?: string;
  relationship: string;
  jobId: string;
  jobTitle: string;
  skills?: string;
  experienceYears: number;
  note?: string;
};

export const submitReferral = async (payload: NewReferral) => unwrap((await api.post('/me/referrals', payload)).data);

export const getMyReferralDetail = async (id: string): Promise<Referral> =>
  unwrap((await api.get(`/me/referrals/${encodeURIComponent(id)}`)).data);

export async function getOpenPosts(): Promise<Record<string, any>[]> {
  const res = unwrap((await api.get('/recruitment/open-posts')).data);
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}
