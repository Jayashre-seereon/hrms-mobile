import { api } from '@/lib/api';

/**
 * Same endpoints as the web app (src/services/api/endpoints/promotions.js):
 * GET /emp/movements → { promotions: [...], ...other movement lists }
 */
export type Promotion = Record<string, any>;

export async function getMyMovements(): Promise<Record<string, any>> {
  const { data } = await api.get('/emp/movements');
  return data ?? {};
}

export const acknowledgeMyPromotion = async (id: string) =>
  (await api.post(`/emp/promotions/${encodeURIComponent(id)}/acknowledge`, {})).data;

export const queryMyPromotion = async (id: string, body: { description: string; attachments: unknown[] }) =>
  (await api.post(`/emp/promotions/${encodeURIComponent(id)}/queries`, body)).data;

/** Files: [{ uri, name, type }] from expo-document-picker. Returns { attachments: [...] }. */
export async function uploadQueryAttachments(id: string, files: { uri: string; name: string; type: string }[]) {
  const form = new FormData();
  files.forEach((f) => form.append('files', f as any));
  const { data } = await api.post(`/cases/promotions/${encodeURIComponent(id)}/query-attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as { attachments?: unknown[] };
}
