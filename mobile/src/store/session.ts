import { create } from 'zustand';

import { getMe, login, Me } from '@/api/auth';
import { setApiHandlers } from '@/lib/api';
import { tokens } from '@/lib/tokens';

type Status = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: Status;
  me: Me | null;
  mustChangePassword: boolean;
  bootstrap: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  passwordChanged: (t?: { access_token?: string; refresh_token?: string }) => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  me: null,
  mustChangePassword: false,

  /** On app start: load saved tokens and check them with GET /me. */
  async bootstrap() {
    const { access, refresh } = await tokens.load();
    if (!access && !refresh) {
      set({ status: 'signedOut' });
      return;
    }
    try {
      const me = await getMe();
      set({ status: 'signedIn', me, mustChangePassword: Boolean(me?.must_change_password) });
    } catch (e: any) {
      // 403 "password change required" keeps the session; anything else (expired, offline) → sign in again.
      if (get().mustChangePassword) set({ status: 'signedIn' });
      else if (!e?.response) set({ status: 'signedIn' }); // offline: keep the session, screens show their own errors
      else {
        await tokens.clear();
        set({ status: 'signedOut', me: null });
      }
    }
  },

  async signIn(identifier, password) {
    const data = await login(identifier, password);
    await tokens.set(data);
    const mustChange = Boolean(data.must_change_password ?? data.user?.must_change_password);
    let me: Me | null = { ...data };
    try {
      me = await getMe();
    } catch {
      // keep the login response as identity
    }
    set({ status: 'signedIn', me, mustChangePassword: mustChange || Boolean(me?.must_change_password) });
  },

  async signOut() {
    await tokens.clear();
    set({ status: 'signedOut', me: null, mustChangePassword: false });
  },

  async refreshMe() {
    const me = await getMe();
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
}));

setApiHandlers({
  onSignedOut: () => {
    useSession.getState().signOut();
  },
  onPasswordChangeRequired: () => useSession.setState({ mustChangePassword: true }),
});

/** Flattens the different /me shapes (top level, .user, .employee) into one profile object. */
export function profileOf(me: Me | null): Record<string, any> {
  if (!me) return {};
  return { ...(me.user ?? {}), ...(me.employee ?? {}), ...me };
}

export function displayName(me: Me | null): string {
  const p = profileOf(me);
  return p.full_name || p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'there';
}
