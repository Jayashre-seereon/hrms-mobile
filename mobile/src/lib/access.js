import { useSession } from '@/store/session';
/**
 * Role / permission checks — same rules as the web app (src/features/auth/data/module-access.js):
 * admins hold everything in their scope; others need "<module>.view|edit|delete" in /me.permissions.
 * The backend still enforces everything; this only hides what the user cannot use.
 */
export function roleOf(me) {
  return String(me?.role ?? me?.user?.role ?? '').toUpperCase();
}
export function isAdminRole(role) {
  return ['SUPER_ADMIN', 'SUPERADMIN', 'COMPANY_ADMIN'].includes(role);
}
export function isSuperAdmin(me) {
  return ['SUPER_ADMIN', 'SUPERADMIN'].includes(roleOf(me));
}
export function permissionsOf(me) {
  const list = me?.permissions ?? me?.user?.permissions;
  return Array.isArray(list) ? list : [];
}
export function canDo(me, permission) {
  if (isAdminRole(roleOf(me))) return true;
  const list = permissionsOf(me);
  return list.includes('*') || list.includes(permission);
}
const moduleKeys = (me) => {
  const mods = me?.permitted_modules ?? me?.user?.permitted_modules;
  return Array.isArray(mods)
    ? mods.map((m) => String(typeof m === 'string' ? m : (m?.key ?? m?.module_key ?? '')).toLowerCase())
    : null;
};
/**
 * True when the user may use this module ("leave", "employee", "payroll", "helpdesk", ...) — same rule as the web
 * sidebar (module-access.js): the key must be in /me.permitted_modules. For a Company Admin that list is exactly the
 * modules enabled for the company, so a switched-off module (e.g. helpdesk → grievances) is hidden instead of
 * answering 403 "Module not enabled for this company". A Super Admin is not bound to one company: the backend
 * module guard always lets them through. Pass several keys for "any of".
 */
export function hasModule(me, ...modules) {
  const wanted = modules.flat().map((m) => String(m).toLowerCase());
  if (isSuperAdmin(me)) return true;
  const keys = moduleKeys(me);
  if (keys && wanted.some((m) => keys.includes(m))) return true;
  if (isAdminRole(roleOf(me))) return keys === null; // older /me without the list: show, the server still decides
  return permissionsOf(me).some((p) => p === '*' || wanted.some((m) => p.startsWith(`${m}.`)));
}
/** Employees see the self-service area; admins / HR also get the admin area. */
export function isOrgUser(me) {
  const role = roleOf(me);
  return role !== '' && role !== 'EMPLOYEE' ? true : me?.redirect_portal === 'org';
}
export function useAccess() {
  const me = useSession((s) => s.me);
  return {
    me,
    role: roleOf(me),
    isAdmin: isAdminRole(roleOf(me)),
    isSuperAdmin: isSuperAdmin(me),
    isOrgUser: isOrgUser(me),
    can: (permission) => canDo(me, permission),
    hasModule: (...modules) => hasModule(me, ...modules),
  };
}
/** Super Admin company scope (web: CompanySwitcher). `needsCompany` = Super Admin with no company picked. */
export function useScope() {
  const me = useSession((s) => s.me);
  const companyId = useSession((s) => s.scopeCompanyId);
  const companyName = useSession((s) => s.scopeCompanyName);
  const superAdmin = isSuperAdmin(me);
  return {
    isSuperAdmin: superAdmin,
    companyId,
    companyName,
    needsCompany: superAdmin && !companyId,
  };
}
