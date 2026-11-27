/** Helpers shared by the admin API files (same unwrapping rules as the web adapters). */
/** Drops empty params so the backend only sees real filters. */
export const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all'),
  );
/** `{ data: {...} }` → `{...}` (APIResponse envelope). Arrays and plain bodies are returned as-is. */
export function unwrap(body) {
  if (body && !Array.isArray(body) && body.data != null && typeof body.data === 'object') return body.data;
  return body;
}
/** Any list shape (`[...]`, `{ items }`, `{ results }`, `{ data: [...] }`, `{ data: { items } }`) → array. */
export function rowsOf(body, ...extraKeys) {
  const d = unwrap(body);
  if (Array.isArray(d)) return d;
  for (const k of ['items', 'results', ...extraKeys]) if (Array.isArray(d?.[k])) return d[k];
  return [];
}
export const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
/** "First Last" from the usual employee fields. */
export const personName = (e = {}) =>
  e.full_name ||
  e.employee_display ||
  e.employee_name ||
  [e.first_name, e.last_name].filter(Boolean).join(' ') ||
  e.name ||
  e.work_email ||
  '';
