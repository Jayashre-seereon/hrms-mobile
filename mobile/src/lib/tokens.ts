import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Access / refresh tokens. Stored in the device keychain (SecureStore) on Android/iOS,
 * localStorage on web (Expo web preview only). Kept in memory too so every request
 * does not have to read storage.
 */
const ACCESS_KEY = 'hrms.access_token';
const REFRESH_KEY = 'hrms.refresh_token';

let access: string | null = null;
let refresh: string | null = null;

const isWeb = Platform.OS === 'web';

async function read(key: string) {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string | null) {
  if (isWeb) {
    if (value) globalThis.localStorage?.setItem(key, value);
    else globalThis.localStorage?.removeItem(key);
    return;
  }
  if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}

export const tokens = {
  /** Loads saved tokens into memory. Call once when the app starts. */
  async load() {
    access = await read(ACCESS_KEY);
    refresh = await read(REFRESH_KEY);
    return { access, refresh };
  },
  getAccess: () => access,
  getRefresh: () => refresh,
  async set(t: { access_token?: string | null; refresh_token?: string | null }) {
    if (t.access_token) {
      access = t.access_token.replace(/^Bearer\s+/i, '');
      await write(ACCESS_KEY, access);
    }
    if (t.refresh_token) {
      refresh = t.refresh_token;
      await write(REFRESH_KEY, refresh);
    }
  },
  async clear() {
    access = null;
    refresh = null;
    await write(ACCESS_KEY, null);
    await write(REFRESH_KEY, null);
  },
};
