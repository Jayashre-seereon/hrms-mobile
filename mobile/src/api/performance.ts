import { api } from '@/lib/api';

/** Same endpoint and mapping as the web app (src/api/performance_indicator.js + performanceIndicatorAdapter.js). */
export type Indicator = {
  id: string;
  code?: string;
  name: string;
  category: string;
  unit: string;
  target: string;
  status: string;
  description: string;
};

const extractList = (data: any): any[] => {
  const d = data?.data ?? data;
  if (Array.isArray(d)) return d;
  return d?.items ?? d?.results ?? d?.data ?? [];
};

export async function getPerformanceIndicators(): Promise<Indicator[]> {
  const { data } = await api.get('/performance-indicators');
  return extractList(data).map((r: any) => ({
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
