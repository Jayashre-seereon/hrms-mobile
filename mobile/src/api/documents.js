import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
export async function getMyDocuments() {
  const { data } = await api.get('/me/documents');
  return Array.isArray(data) ? data : (data?.documents ?? data?.items ?? []);
}
/** Absolute URL for a backend path such as "/files/…" (same rule as web resolveApiUrl). */
export function resolveApiUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = API_URL.match(/^https?:\/\/[^/]+/i)?.[0] ?? '';
  return url.startsWith('/') ? `${origin}${url}` : `${API_URL}/${url}`;
}
