import { api } from '@/lib/api';
import { clean, rowsOf } from './common';
/** Roles & access (read-only) — same endpoints as the web rbacApi (src/api/rbacApi.js). */
const body = (res) => res.data?.data ?? res.data;
export const listRoles = async () => rowsOf(body(await api.get('/roles')), 'roles');
export const getRole = async (id) => body(await api.get(`/roles/${encodeURIComponent(id)}`));
export const listRoleAssignments = async (params = {}) =>
  rowsOf(body(await api.get('/roles/assignments', { params: clean(params) })), 'assignments');
