import { api } from '@/lib/api';

import { clean, rowsOf } from './common';

/** Roles & access (read-only) — same endpoints as the web rbacApi (src/api/rbacApi.js). */
const body = (res: { data: any }) => res.data?.data ?? res.data;

export const listRoles = async () => rowsOf(body(await api.get('/roles')), 'roles');

export const getRole = async (id: string) => body(await api.get(`/roles/${encodeURIComponent(id)}`)) as Record<string, any>;

export const listRoleAssignments = async (params: Record<string, any> = {}) =>
  rowsOf(body(await api.get('/roles/assignments', { params: clean(params) })), 'assignments');
