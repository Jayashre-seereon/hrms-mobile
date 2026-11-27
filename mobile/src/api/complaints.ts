import { api } from '@/lib/api';

/** Same endpoints as the web app (src/api/grievanceApi.js — employee self-service /me/grievances). */
const unwrap = (data: any) => data?.data ?? data;

export const GRIEVANCE_CATEGORIES = [
  'Harassment (POSH)',
  'Discrimination',
  'Workplace safety',
  'Payroll / salary dispute',
  'Leave / attendance',
  'Manager behaviour',
  'Facilities',
  'Policy violation',
  'Other',
];

export const GRIEVANCE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export type Grievance = Record<string, any>;

export async function getMyGrievances({ page = 1, pageSize = 50, status, search }: { page?: number; pageSize?: number; status?: string; search?: string } = {}): Promise<Grievance[]> {
  const params: Record<string, unknown> = { page, pageSize };
  if (status && status !== 'all') params.status = status;
  if (search) params.search = search;
  const res = unwrap((await api.get('/me/grievances', { params })).data);
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

export type NewGrievance = {
  category: string;
  severity: string;
  subject: string;
  description: string;
  against?: string;
  isAnonymous: boolean;
  attachments: string[];
};

export const submitGrievance = async (payload: NewGrievance) => unwrap((await api.post('/me/grievances', payload)).data);

export const getMyGrievanceDetail = async (id: string): Promise<Grievance> =>
  unwrap((await api.get(`/me/grievances/${encodeURIComponent(id)}`)).data);

export const withdrawGrievance = async (id: string) =>
  unwrap((await api.post(`/me/grievances/${encodeURIComponent(id)}/withdraw`, {})).data);

export const closeGrievance = async (id: string, { rating, feedback }: { rating: number; feedback?: string }) =>
  unwrap(
    (await api.post(`/me/grievances/${encodeURIComponent(id)}/close`, { rating: Number(rating), feedback: feedback?.trim() || undefined }))
      .data,
  );

export const appealGrievance = async (id: string, reason: string) =>
  unwrap((await api.post(`/me/grievances/${encodeURIComponent(id)}/appeal`, { reason: reason.trim() })).data);
