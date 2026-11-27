/**
 * Backend base URL, e.g. http://192.168.1.10:8000/api/v1 (no trailing slash).
 * Set EXPO_PUBLIC_API_URL in mobile/.env.local for development.
 * On a phone, "localhost" is the phone itself — use your PC's LAN IP instead.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');
export const API_TIMEOUT_MS = 20000;
