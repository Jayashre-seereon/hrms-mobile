import { api } from '@/lib/api';
export async function getMyMovements() {
  const { data } = await api.get('/emp/movements');
  return data ?? {};
}
export const acknowledgeMyPromotion = async (id) =>
  (await api.post(`/emp/promotions/${encodeURIComponent(id)}/acknowledge`, {})).data;
export const queryMyPromotion = async (id, body) =>
  (await api.post(`/emp/promotions/${encodeURIComponent(id)}/queries`, body)).data;
/** Files: [{ uri, name, type }] from expo-document-picker. Returns { attachments: [...] }. */
export async function uploadQueryAttachments(id, files) {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const { data } = await api.post(`/cases/promotions/${encodeURIComponent(id)}/query-attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
