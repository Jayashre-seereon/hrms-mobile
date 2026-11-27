import { useColorScheme } from 'react-native';
import { useSession } from '@/store/session';
import { companyBranding, darken, forDarkMode, tint } from './brand';
/**
 * Seereon HRMS brand — same palette as the web app (hrms-frontenddev/src/globals.css):
 * emerald primary, dark-emerald sidebar / gradient end, gold accent, emerald-tinted neutrals.
 * Screens read these through useColors(); never hard-code colours in a screen.
 */
const light = {
  primary: '#0F6B50', // --brand-emerald
  primaryDark: '#0B4F3A', // --brand-emerald-dark (gradient end, sidebar)
  primaryText: '#FFFFFF',
  primarySoft: '#E6F2EC', // tinted chip / icon background
  gold: '#C8A951', // --brand-gold (accent, active menu item)
  goldText: '#634800', // --gold-ink (readable gold text on light)
  goldSoft: '#F7EFD9',
  background: '#F8FAF8', // --background
  card: '#FFFFFF',
  text: '#09140F', // --foreground
  muted: '#54615B', // --muted-foreground
  mutedBg: '#EDF3F0', // --muted
  border: '#DFE7E2', // --border
  danger: '#E62C2C', // --destructive
  dangerSoft: '#FDE8E8',
  success: '#0F6B50',
  successSoft: '#E6F2EC',
  warning: '#B7791F',
  warningSoft: '#FDF3E1',
  info: '#3B8F93', // --chart-3
  infoSoft: '#E3F1F2',
  violet: '#7D5FAD', // --chart-5
  violetSoft: '#EFE9F7',
  orange: '#EB7A52', // --chart-4
  orangeSoft: '#FDEDE6',
  // side menu (web sidebar)
  sidebar: '#0B4F3A',
  sidebarText: '#E4F3EA',
  sidebarMuted: '#9FC3B2',
  sidebarAccent: '#043726',
  sidebarBorder: '#1A5E48',
  sidebarActive: '#C8A951',
  sidebarActiveText: '#1F1A0B',
  gradient: ['#0F6B50', '#0B4F3A'],
};
const dark = {
  primary: '#5FC199',
  primaryDark: '#0B3C2B',
  primaryText: '#04140D',
  primarySoft: '#13302A',
  gold: '#EEC55E',
  goldText: '#F2CD6F',
  goldSoft: '#2E2914',
  background: '#060D0B',
  card: '#101917',
  text: '#E9F1ED',
  muted: '#9CA8A2',
  mutedBg: '#1E2624',
  border: '#1F2926',
  danger: '#FF6367',
  dangerSoft: '#3A1517',
  success: '#5FC199',
  successSoft: '#13302A',
  warning: '#F2B84B',
  warningSoft: '#33270F',
  info: '#6CC3C7',
  infoSoft: '#132C2E',
  violet: '#B49AE0',
  violetSoft: '#251D33',
  orange: '#F59A78',
  orangeSoft: '#35201A',
  sidebar: '#06120E',
  sidebarText: '#D8E0DC',
  sidebarMuted: '#7E8F87',
  sidebarAccent: '#152921',
  sidebarBorder: '#18241F',
  sidebarActive: '#EEC55E',
  sidebarActiveText: '#1A1608',
  gradient: ['#245A47', '#0B3C2B'],
};
/** Palette with the company's colour applied (web Appearance.jsx: primary + darken(primary, 0.12); dark mode lifted). */
const cache = new Map();
function branded(base, color, scheme) {
  const key = `${scheme}|${color}`;
  if (cache.has(key)) return cache.get(key);
  const darkHex = darken(color, 0.12);
  const primary = scheme === 'dark' ? forDarkMode(color, 0.7) : color;
  const primaryDark = scheme === 'dark' ? forDarkMode(darkHex, 0.3) : darkHex;
  const out = {
    ...base,
    primary,
    primaryDark,
    primarySoft: scheme === 'dark' ? forDarkMode(color, 0.16) : tint(color, 0.94),
    success: primary,
    successSoft: scheme === 'dark' ? forDarkMode(color, 0.16) : tint(color, 0.94),
    sidebar: scheme === 'dark' ? base.sidebar : darkHex,
    sidebarAccent: scheme === 'dark' ? base.sidebarAccent : darken(darkHex, 0.08),
    sidebarBorder: scheme === 'dark' ? base.sidebarBorder : darken(darkHex, -0.06),
    gradient: scheme === 'dark' ? [forDarkMode(color, 0.3), primaryDark] : [color, darkHex],
  };
  cache.set(key, out);
  return out;
}

export function useColors() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Company colour from /me (null for Super Admin / when signed out → Seereon emerald).
  const color = useSession((s) => companyBranding(s.me).color);
  const base = scheme === 'dark' ? dark : light;
  return color ? branded(base, color, scheme) : base;
}
