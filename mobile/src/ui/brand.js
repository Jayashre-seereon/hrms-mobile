/**
 * Company branding — same rules as the web (components/brand/company-branding.js + layout/Appearance.jsx):
 * the company's own colour (company.color_code from /me, set by the Super Admin) replaces the brand emerald for
 * everyone inside that company; primary-dark = darken(colour, 0.12); dark mode uses forDarkMode(…). Platform roles
 * (Super Admin / Master Admin) always keep the product look. Colour maths ported from
 * features/administration/data/appearance.js.
 */
import { API_URL } from '@/lib/config';

const PLATFORM_ROLES = new Set(['SUPER_ADMIN', 'SUPERADMIN', 'MASTER_ADMIN', 'MASTERADMIN']);

export const isValidHex = (v) => /^#([0-9a-f]{6})$/i.test(String(v ?? '').trim());

export function hexToHsl(hex) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return [165, 0.75, 0.24];
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

export function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const to = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${rgb.map(to).join('')}`.toUpperCase();
}

/** Lighter, slightly less saturated version for dark mode (web forDarkMode). */
export const forDarkMode = (hex, targetL = 0.68) => {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, Math.min(0.75, s * 0.9), targetL);
};
export const darken = (hex, by = 0.12) => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0.08, l - by));
};
/** Very light tint of the colour for chips / icon backgrounds. */
export const tint = (hex, l = 0.93) => {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, Math.min(0.45, s), l);
};

/** { color, logo, name } of the signed-in user's company; all null for platform roles (web useCompanyBranding). */
export function companyBranding(me) {
  const role = String(me?.role ?? me?.user?.role ?? '').toUpperCase();
  const company = me?.company ?? me?.user?.company ?? null;
  if (!me || PLATFORM_ROLES.has(role) || !company) return { color: null, logo: null, name: null };
  return {
    color: isValidHex(company.color_code) ? company.color_code.trim().toUpperCase() : null,
    logo: resolveLogoUrl(company.logo_url),
    name: company.name ?? null,
  };
}

/** Backend returns the logo as a path on its own host (/api/v1/companies/{id}/logo) — make it absolute. */
export function resolveLogoUrl(url) {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const origin = API_URL.match(/^https?:\/\/[^/]+/i)?.[0] ?? '';
  return url.startsWith('/') ? `${origin}${url}` : `${API_URL}/${url}`;
}
