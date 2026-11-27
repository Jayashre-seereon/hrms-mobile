/**
 * Port of the web app's src/services/api/scope.js.
 *
 * Only a Super Admin has a selectable company: it goes out as `X-Company-Id`. Company / Branch Admins and
 * employees are scoped by the server from their token and never send any scope.
 *
 * The session store pushes the role and the picked company in here (setScopeContext), so the HTTP client
 * never imports the store (that would be an import cycle).
 */
let role = '';
let companyId = '';
export function setScopeContext(next) {
  if (next.role !== undefined) role = String(next.role ?? '').toUpperCase();
  if (next.companyId !== undefined) companyId = next.companyId ? String(next.companyId) : '';
}
export const isSuperAdminRole = (r = role) => r === 'SUPER_ADMIN' || r === 'SUPERADMIN';
const stripHost = (url) => String(url ?? '').replace(/^https?:\/\/[^/]+(?:\/api\/v\d+)?/, '');
/** Calls that belong to the organisation, not to a company — they never carry X-Company-Id. */
const ORG_LEVEL_URL =
  /^\/?(?:super-admin\/companies|companies|org\/(?:dashboard|reports)|auth\/|modules\/catalog)(?:[/?]|$)/;
export const isOrgLevelUrl = (url) => ORG_LEVEL_URL.test(stripHost(url ?? ''));
/**
 * Master-data endpoints (warning types, shifts, leave types …). Scope keys are stripped from their query and body;
 * employee / department / branch fields on other endpoints are real data and stay.
 */
const MASTER_DATA_URL =
  /^\/?(?:warning-types|complaint-types|leave-types|termination-types|performance-indicators|performance\/|attendance\/(?:shifts|patterns|holiday-calendars|workday-configurations)|attendance-and-time\/timesheet-formats|recruitment\/|assets\/asset-types|onboarding\/documents|documents\/policies-circulars)/;
export const isMasterDataUrl = (url) => MASTER_DATA_URL.test(stripHost(url ?? ''));
const COMPANY_KEYS = ['company_id', 'companyId', 'organization_id', 'organizationId'];
const BRANCH_KEYS = ['branch_id', 'branchId'];
function without(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj instanceof FormData) return obj;
  const out = { ...obj };
  keys.forEach((k) => delete out[k]);
  return out;
}
/** Applies the scope rules to an axios request config (mutates and returns it). */
export function applyScopeRules(config) {
  const url = config.url ?? '';
  if (isOrgLevelUrl(url)) return config;
  if (isSuperAdminRole() && companyId) config.headers.set('X-Company-Id', companyId);
  else config.headers.delete('X-Company-Id');
  const master = isMasterDataUrl(url);
  // Company / organisation scope never travels as a query parameter; branch filters are kept except on masters.
  config.params = without(config.params, master ? [...COMPANY_KEYS, ...BRANCH_KEYS] : COMPANY_KEYS);
  if (master && /^(post|put|patch)$/i.test(config.method ?? '')) {
    config.data = without(config.data, [...COMPANY_KEYS, ...BRANCH_KEYS]);
  }
  return config;
}
