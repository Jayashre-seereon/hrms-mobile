import { api } from '@/lib/api';

import { clean, num, rowsOf } from './common';

/** Same endpoints as the web app (src/api/employeeApi.js). */

export type EmployeePage = { items: any[]; total: number | null; page: number; limit: number };

/** GET /employees — paginated, `search` / `status` filters (limit max 100). */
export async function getEmployees({
  page = 1,
  limit = 20,
  search = '',
  status = '',
}: { page?: number; limit?: number; search?: string; status?: string } = {}): Promise<EmployeePage> {
  const { data } = await api.get('/employees', {
    params: clean({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      search: search.trim(),
      status,
    }),
  });
  const items = rowsOf(data);
  return { items, total: Array.isArray(data) ? items.length : num(data?.total ?? data?.count), page, limit };
}

/** GET /employees/{id} — `id` is the employee profile id (not user_id). */
export async function getEmployeeById(id: string) {
  const { data } = await api.get(`/employees/${encodeURIComponent(id)}`);
  return data?.data && !Array.isArray(data.data) ? data.data : data;
}

/** GET /employees/{id}/documents */
export async function getEmployeeDocuments(id: string) {
  const { data } = await api.get(`/employees/${encodeURIComponent(id)}/documents`);
  return rowsOf(data, 'documents');
}
