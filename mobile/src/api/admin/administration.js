import { api } from '@/lib/api';
import { rowsOf } from './common';
/**
 * Administration module (backend app/modules/administration/router.py, prefix /admin).
 *
 * Role delegations:
 *   GET  /admin/delegations — delegations created BY the signed-in user (no query params).
 *        → [{ id, delegator_user_id, delegatee_user_id, role_id, start_date, end_date, reason, is_active }]
 *   POST /admin/delegations — needs permission "roles.delegate".
 *        body RoleDelegationCreate { delegatee_user_id (user UUID), role_id (UUID), start_date, end_date
 *        (ISO datetimes, end > start), reason? }. Delegating to yourself → 400.
 *
 * Organization settings (key/value strings, scoped to the user's organization_id):
 *   GET  /admin/settings — needs "settings.manage" → [{ id, organization_id, setting_key, setting_value, description }]
 *   POST /admin/settings — needs "settings.manage"; creates or updates by key.
 *        body SettingCreateOrUpdate { setting_key (≤100 chars), setting_value (string), description? }
 */
export const listDelegations = async () => rowsOf((await api.get('/admin/delegations')).data);

export async function createDelegation({ delegateeUserId, roleId, startDate, endDate, reason }) {
  const body = {
    delegatee_user_id: delegateeUserId,
    role_id: roleId,
    start_date: startDate,
    end_date: endDate,
  };
  if (reason && reason.trim()) body.reason = reason.trim();
  const { data } = await api.post('/admin/delegations', body);
  return data;
}

export const listSettings = async () => rowsOf((await api.get('/admin/settings')).data);

export async function saveSetting({ key, value, description }) {
  const body = { setting_key: String(key).trim(), setting_value: String(value ?? '') };
  if (description && description.trim()) body.description = description.trim();
  const { data } = await api.post('/admin/settings', body);
  return data;
}
