import { api } from '@/lib/api';
const extractList = (data) => {
  const d = data?.data ?? data;
  if (Array.isArray(d)) return d;
  return d?.items ?? d?.results ?? d?.data ?? [];
};
export async function getPerformanceIndicators() {
  const { data } = await api.get('/performance-indicators');
  return extractList(data).map((r) => ({
    id: String(r.id),
    code: r.code || undefined,
    name: r.name ?? '',
    category: r.category_name ?? r.category ?? '',
    unit: r.measurement_unit ?? '',
    target: r.target_value === null || r.target_value === undefined ? '' : String(r.target_value),
    status: r.status ?? '',
    description: r.description ?? '',
  }));
}
