import { Me } from '@/api/auth';
import { useSession } from '@/store/session';

/**
 * Role / permission checks — same rules as the web app (src/features/auth/data/module-access.js):
 * admins hold everything in their scope; others need "<module>.view|edit|delete" in /me.permissions.
 * The backend still enforces everything; this only hides what the user cannot use.
 */
export function roleOf(me: Me | null): string {
  return String(me?.role ?? me?.user?.role ?? '').toUpperCase();
}

export function isAdminRole(role: string) {
  return ['SUPER_ADMIN', 'SUPERADMIN', 'COMPANY_ADMIN'].includes(role);
}

export function isSuperAdmin(me: Me | null) {
  return ['SUPER_ADMIN', 'SUPERADMIN'].includes(roleOf(me));
}

export function permissionsOf(me: Me | null): string[] {
  const list = me?.permissions ?? me?.user?.permissions;
  return Array.isArray(list) ? list : [];
}

export function canDo(me: Me | null, permission: string) {
  if (isAdminRole(roleOf(me))) return true;
  const list = permissionsOf(me);
  return list.includes('*') || list.includes(permission);
}

/** True when the user's roles grant anything in this module ("leave", "employee", "payroll", ...). */
export function hasModule(me: Me | null, module: string) {
  if (isAdminRole(roleOf(me))) return true;
  const mods = me?.permitted_modules;
  if (Array.isArray(mods) && mods.some((m: unknown) => String(typeof m === 'string' ? m : (m as any)?.key ?? '').toLowerCase() === module)) {
    return true;
  }
  return permissionsOf(me).some((p) => p === '*' || p.startsWith(`${module}.`));
}

/** Employees see the self-service area; admins / HR also get the admin area. */
export function isOrgUser(me: Me | null) {
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
    can: (permission: string) => canDo(me, permission),
    hasModule: (module: string) => hasModule(me, module),
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
