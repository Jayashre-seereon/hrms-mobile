import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
/** Small JSON key/value store: SecureStore on Android/iOS, localStorage on web. */
const isWeb = Platform.OS === 'web';
export async function readJSON(key) {
  try {
    const raw = isWeb ? (globalThis.localStorage?.getItem(key) ?? null) : await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export async function writeJSON(key, value) {
  try {
    if (value === null || value === undefined) {
      if (isWeb) globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
      return;
    }
    const raw = JSON.stringify(value);
    if (isWeb) globalThis.localStorage?.setItem(key, raw);
    else await SecureStore.setItemAsync(key, raw);
  } catch {
    // storage blocked: the in-memory value still applies for this session
  }
}
