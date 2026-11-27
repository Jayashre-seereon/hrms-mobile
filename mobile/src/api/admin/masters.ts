import { api } from '@/lib/api';

import { rowsOf, unwrap } from './common';

/**
 * Generic CRUD for master data. Every master in features/masters/registry.ts is a REST
 * collection: GET base, GET base/{id}, POST base, PUT base/{id}, DELETE base/{id}.
 * Company / branch scope comes from the token (same as web, where scope IDs are only query params).
 */

export async function listMaster(endpoint: string, listParams?: Record<string, any>) {
  const { data } = await api.get(endpoint, { params: listParams });
  return rowsOf(data);
}

export async function getMasterItem(endpoint: string, id: string) {
  const { data } = await api.get(`${endpoint}/${encodeURIComponent(id)}`);
  return unwrap(data) as Record<string, any>;
}

export async function createMasterItem(endpoint: string, body: Record<string, any>) {
  return unwrap((await api.post(endpoint, body)).data);
}

export async function updateMasterItem(endpoint: string, id: string, body: Record<string, any>) {
  return unwrap((await api.put(`${endpoint}/${encodeURIComponent(id)}`, body)).data);
}

export async function deleteMasterItem(endpoint: string, id: string) {
  return (await api.delete(`${endpoint}/${encodeURIComponent(id)}`)).data;
}

/** Options for a select field: accepts strings or objects. */
export async function loadOptions(endpoint: string, labelKey: string, valueKey = 'id', params?: Record<string, any>) {
  const { data } = await api.get(endpoint, { params });
  const d = unwrap(data);
  const rows: any[] = Array.isArray(d) ? d : (d?.items ?? d?.results ?? d?.data ?? d?.categories ?? []);
  return rows
    .map((o) =>
      typeof o === 'string'
        ? { label: o, value: o }
        : {
            label: String(o?.[labelKey] ?? o?.name ?? o?.label ?? o?.[valueKey] ?? ''),
            value: String(o?.[valueKey] ?? o?.value ?? o?.[labelKey] ?? ''),
          },
    )
    .filter((o) => o.label && o.value);
}
