/** Time like "09:12 AM" from an ISO date-time or "HH:MM[:SS]" string. */
export function fmtTime(v) {
  if (!v) return '—';
  if (/^\d{2}:\d{2}/.test(v)) {
    const [h, m] = v.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
