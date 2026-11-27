import { useQuery } from '@tanstack/react-query';

import {
  getActivePayGrades,
  getBranches,
  getCompanies,
  getCompany,
  getDepartmentOptions,
  getDesignationOptions,
  getOrganisation,
  getPayComponents,
  getRoleOptions,
  getShiftOptions,
  getStaffOptions,
} from '@/api/admin/employees';
import { isUuid } from './constants';

/** A failing option list must not break the form (web: each loader is wrapped in safe()). */
const safe = (fn) => () => fn().catch(() => []);

/**
 * Dropdown data for the employee Add / Edit form — same sources as the web's useEmployeeJobOptions,
 * plus companies / branches / pay grades / pay components the web form loads itself.
 */
export function useEmployeeFormOptions({ companyId, orgId, isSuperAdmin, workEmailCompanyId, isEdit }) {
  const company = isUuid(companyId) ? companyId : '';

  const departments = useQuery({
    queryKey: ['admin', 'employee-form', 'departments', company],
    queryFn: safe(() => getDepartmentOptions(company)),
  });
  const designations = useQuery({
    queryKey: ['admin', 'employee-form', 'designations', company],
    queryFn: safe(() => getDesignationOptions(company)),
  });
  const roles = useQuery({
    queryKey: ['admin', 'employee-form', 'roles', company],
    queryFn: safe(() => getRoleOptions(company)),
  });
  const shifts = useQuery({
    queryKey: ['admin', 'employee-form', 'shifts', orgId || ''],
    queryFn: safe(() => getShiftOptions(isUuid(orgId) ? orgId : '')),
  });
  const managers = useQuery({
    queryKey: ['admin', 'employee-form', 'managers', company],
    queryFn: safe(() => getStaffOptions('manager', company)),
  });
  const hrs = useQuery({
    queryKey: ['admin', 'employee-form', 'hrs', company],
    queryFn: safe(() => getStaffOptions('hr', company)),
  });
  const grades = useQuery({ queryKey: ['admin', 'employee-form', 'grades'], queryFn: safe(getActivePayGrades) });
  const payComponents = useQuery({
    queryKey: ['admin', 'employee-form', 'pay-components'],
    queryFn: safe(getPayComponents),
  });
  const companies = useQuery({
    queryKey: ['admin', 'employee-form', 'companies'],
    queryFn: safe(getCompanies),
    enabled: !!isSuperAdmin,
  });
  const branches = useQuery({
    queryKey: ['admin', 'employee-form', 'branches', company],
    queryFn: safe(() => getBranches(company)),
    enabled: !!company,
  });
  // Work email (create only): organisation name + the joining company's work email prefix.
  const organisation = useQuery({
    queryKey: ['admin', 'employee-form', 'organisation'],
    queryFn: () => getOrganisation().catch(() => ({})),
    enabled: !isEdit,
  });
  const weCompany = isUuid(workEmailCompanyId) ? workEmailCompanyId : '';
  const listedCompany = (companies.data ?? []).find((c) => String(c.id) === String(weCompany));
  const fetchedCompany = useQuery({
    queryKey: ['admin', 'employee-form', 'company', weCompany],
    queryFn: () => getCompany(weCompany).catch(() => ({})),
    enabled: !isEdit && !!weCompany && !listedCompany,
  });
  const o = organisation.data ?? {};

  return {
    departments: departments.data ?? [],
    designations: designations.data ?? [],
    roles: roles.data ?? [],
    shifts: shifts.data ?? [],
    managers: managers.data ?? [],
    hrs: hrs.data ?? [],
    grades: grades.data ?? [],
    payComponents: payComponents.data ?? [],
    companies: companies.data ?? [],
    branches: company ? (branches.data ?? []) : [],
    loadingCompanies: companies.isLoading,
    orgName: o?.name || o?.organisation_name || o?.organization_name || o?.legal_name || '',
    workEmailPrefix: listedCompany ? listedCompany.work_email_prefix : (fetchedCompany.data?.work_email_prefix ?? ''),
  };
}
