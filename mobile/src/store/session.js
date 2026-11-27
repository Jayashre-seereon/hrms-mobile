import { create } from 'zustand';
import { getMe, login } from '@/api/auth';
import { setApiHandlers } from '@/lib/api';
import { readJSON, writeJSON } from '@/lib/persist';
import { queryClient } from '@/lib/queryClient';
import { isSuperAdminRole, setScopeContext } from '@/lib/scope';
import { tokens } from '@/lib/tokens';
/** Super Admin company being worked in (web: seereon.scope.company.v1) + the role, so the scope applies on app start. */
const SCOPE_KEY = 'hrms.scope.company.v1';
const roleFrom = (x) => String(x?.role ?? x?.user?.role ?? '').toUpperCase();
export const useSession = create((set, get) => ({
  status: 'loading',
  me: null,
  mustChangePassword: false,
  scopeCompanyId: '',
  scopeCompanyName: '',
  needCompany: false,
  /** On app start: load saved tokens + company scope and check them with GET /me. */
  async bootstrap() {
    const [{ access, refresh }, saved] = await Promise.all([tokens.load(), readJSON(SCOPE_KEY)]);
    if (!access && !refresh) {
      set({ status: 'signedOut' });
      return;
    }
    const scopeCompanyId = saved?.id ? String(saved.id) : '';
    setScopeContext({ role: saved?.role ?? '', companyId: scopeCompanyId });
    set({ scopeCompanyId, scopeCompanyName: saved?.name ?? '' });
    try {
      const me = await getMe();
      const role = roleFrom(me) || saved?.role || '';
      setScopeContext({ role });
      await writeJSON(SCOPE_KEY, { id: scopeCompanyId, name: saved?.name ?? '', role });
      set({ status: 'signedIn', me, mustChangePassword: Boolean(me?.must_change_password) });
    } catch (e) {
      // 403 "password change required" keeps the session; anything else (expired, offline) → sign in again.
      if (get().mustChangePassword) set({ status: 'signedIn' });
      else if (!e?.response)
        set({ status: 'signedIn' }); // offline: keep the session, screens show their own errors
      else if (e.response?.status === 400 && /select a company/i.test(JSON.stringify(e.response?.data ?? ''))) {
        set({ status: 'signedIn' }); // Super Admin: the picker opens (needCompany)
      } else {
        await tokens.clear();
        set({ status: 'signedOut', me: null });
      }
    }
  },
  async signIn(identifier, password) {
    const data = await login(identifier, password);
    await tokens.set(data);
    // A new sign-in starts in organisation mode, like the web (the scope is cleared on sign-out).
    const role = roleFrom(data);
    setScopeContext({ role, companyId: '' });
    await writeJSON(SCOPE_KEY, { id: '', name: '', role });
    set({ scopeCompanyId: '', scopeCompanyName: '', needCompany: false });
    const mustChange = Boolean(data.must_change_password ?? data.user?.must_change_password);
    let me = { ...data };
    try {
      me = await getMe();
    } catch {
      // keep the login response as identity
    }
    const finalRole = roleFrom(me) || role;
    if (finalRole !== role) {
      setScopeContext({ role: finalRole });
      await writeJSON(SCOPE_KEY, { id: '', name: '', role: finalRole });
    }
    set({ status: 'signedIn', me, mustChangePassword: mustChange || Boolean(me?.must_change_password) });
  },
  async signOut() {
    await tokens.clear();
    setScopeContext({ role: '', companyId: '' });
    await writeJSON(SCOPE_KEY, null);
    queryClient.clear();
    set({
      status: 'signedOut',
      me: null,
      mustChangePassword: false,
      scopeCompanyId: '',
      scopeCompanyName: '',
      needCompany: false,
    });
  },
  async refreshMe() {
    const me = await getMe();
    const role = roleFrom(me);
    if (role) setScopeContext({ role });
    set({ me });
  },
  /** After a password change the backend may issue new tokens (other devices are signed out). */
  async passwordChanged(t) {
    if (t) await tokens.set(t);
    set({ mustChangePassword: false });
    try {
      await get().refreshMe();
    } catch {
      // not critical
    }
  },
  async selectCompany(id, name = '') {
    const companyId = id ? String(id) : '';
    setScopeContext({ companyId });
    await writeJSON(SCOPE_KEY, { id: companyId, name, role: roleFrom(get().me) });
    set({ scopeCompanyId: companyId, scopeCompanyName: name, needCompany: false });
    // Everything held for the previous company is dropped (web reloads the page here).
    queryClient.clear();
    try {
      await get().refreshMe();
    } catch {
      // screens show their own errors
    }
  },
  async clearCompany() {
    await get().selectCompany('', '');
  },
}));
setApiHandlers({
  onSignedOut: () => {
    useSession.getState().signOut();
  },
  onPasswordChangeRequired: () => useSession.setState({ mustChangePassword: true }),
  onNeedCompany: () => {
    // Role known to the scope layer (also before /me has loaded on app start).
    if (isSuperAdminRole()) useSession.setState({ needCompany: true });
  },
});
/** Flattens the different /me shapes (top level, .user, .employee) into one profile object. */
export function profileOf(me) {
  if (!me) return {};
  return { ...(me.user ?? {}), ...(me.employee ?? {}), ...me };
}
export function displayName(me) {
  const p = profileOf(me);
  return p.full_name || p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'there';
}
