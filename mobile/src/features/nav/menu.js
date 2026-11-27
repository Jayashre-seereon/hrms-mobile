import { useAccess } from '@/lib/access';
import { profileOf } from '@/store/session';
/**
 * Every navigable screen, grouped like the web sidebars (EmpSidebar "My workspace" groups first, then the
 * OrgSidebar admin groups, then the Super Admin "Organisation" group). One source for the side menu and the
 * Menu tab. Each item is shown only when its backend module is on and the user may use it (same gates as the web).
 */
export function useMenuGroups() {
  const { me, isOrgUser, isSuperAdmin, isOrgMode, hasModule, can } = useAccess();
  // Admin / HR account without a linked employee record: self-service screens answer 403 "No employee profile".
  const self = !(isOrgUser && !profileOf(me).employee_id);
  // Super Admin before picking a company (web isOrgMode): only the organisation-level screens.
  const company = isOrgUser && !isOrgMode;
  const att = hasModule('attendance');
  const groups = [
    {
      key: 'overview',
      label: 'Overview',
      items: [
        { icon: 'grid-outline', label: 'Dashboard', href: isOrgMode ? '/admin/org-dashboard' : '/' },
        { icon: 'person-circle-outline', label: 'My Profile', href: '/profile' },
      ],
    },
    {
      key: 'time',
      label: 'Time & Attendance',
      show: self,
      items: [
        { icon: 'finger-print-outline', label: 'Attendance', href: '/attendance', show: att },
        { icon: 'calendar-outline', label: 'Attendance history', href: '/attendance/history', show: att },
        { icon: 'list-outline', label: 'My punches', href: '/attendance/punches', show: att },
        { icon: 'time-outline', label: 'Regularisation', href: '/attendance/regularisation', show: att },
        { icon: 'create-outline', label: 'Punch corrections', href: '/attendance/corrections', show: att },
        { icon: 'swap-horizontal-outline', label: 'Comp-off', href: '/attendance/comp-off', show: att },
        { icon: 'document-text-outline', label: 'My timesheets', href: '/timesheets', show: att },
        { icon: 'airplane-outline', label: 'Leave', href: '/leave', show: hasModule('leave') },
        { icon: 'sunny-outline', label: 'Holiday calendar', href: '/holidays', show: hasModule('attendance', 'leave') },
      ],
    },
    {
      key: 'pay',
      label: 'Payroll & Payslips',
      show: self,
      items: [{ icon: 'cash-outline', label: 'Salary & payslips', href: '/payslips', show: hasModule('payroll') }],
    },
    {
      key: 'workplace',
      label: 'Workplace',
      show: self,
      items: [
        { icon: 'folder-open-outline', label: 'My documents', href: '/documents', show: hasModule('documents') },
        {
          icon: 'speedometer-outline',
          label: 'Performance indicators',
          href: '/performance',
          show: hasModule('performance'),
        },
        {
          icon: 'chatbubble-ellipses-outline',
          label: 'Raise a grievance',
          href: '/complaints',
          show: hasModule('helpdesk'),
        },
        { icon: 'person-add-outline', label: 'Refer a candidate', href: '/referrals', show: hasModule('recruitment') },
      ],
    },
    {
      key: 'career',
      label: 'Career & Exit',
      show: self,
      items: [
        { icon: 'git-compare-outline', label: 'My movements & letters', href: '/movements' },
        { icon: 'exit-outline', label: 'Resignation & exit', href: '/resignation', show: hasModule('exit') },
      ],
    },
    {
      key: 'admin',
      label: 'Administration',
      show: company,
      items: [
        { icon: 'stats-chart-outline', label: 'Admin dashboard', href: '/admin' },
        { icon: 'layers-outline', label: 'Master data', href: '/admin/masters' },
        {
          icon: 'shield-checkmark-outline',
          label: 'Roles & permissions',
          href: '/admin/roles',
          show: hasModule('employee'),
        },
      ],
    },
    {
      key: 'people',
      label: 'People',
      show: company,
      items: [
        { icon: 'people-outline', label: 'Employees', href: '/admin/employees', show: hasModule('employee') },
        {
          icon: 'trending-up-outline',
          label: 'Promotions',
          href: '/movements/manage',
          show: hasModule('employee') && can('employee.edit'),
        },
        { icon: 'person-add-outline', label: 'Referrals', href: '/admin/referrals', show: hasModule('recruitment') },
        {
          icon: 'chatbubbles-outline',
          label: 'Grievance redressal',
          href: '/admin/grievances',
          show: hasModule('helpdesk'),
        },
      ],
    },
    {
      key: 'time-admin',
      label: 'Time & Leave',
      show: company,
      items: [
        { icon: 'calendar-number-outline', label: 'Attendance & shifts', href: '/admin/attendance', show: att },
        { icon: 'bar-chart-outline', label: 'Attendance reports', href: '/admin/attendance-reports', show: att },
        {
          icon: 'lock-closed-outline',
          label: 'Payroll attendance lock',
          href: '/admin/attendance-locks',
          show: att && can('attendance.lock'),
        },
        {
          icon: 'checkmark-done-outline',
          label: 'Leave approvals',
          href: '/leave/approvals',
          show: hasModule('leave'),
        },
        { icon: 'checkmark-circle-outline', label: 'Timesheet approvals', href: '/timesheets/approvals', show: att },
        { icon: 'clipboard-outline', label: 'Compliance', href: '/admin/compliance', show: att },
      ],
    },
    {
      key: 'payroll-admin',
      label: 'Payroll & Finance',
      show: company && hasModule('payroll'),
      items: [
        { icon: 'wallet-outline', label: 'Payroll runs', href: '/admin/payroll-runs' },
        { icon: 'add-circle-outline', label: 'Payroll adjustments', href: '/admin/payroll/adjustments' },
        { icon: 'construct-outline', label: 'Salary components', href: '/admin/payroll/salary-components' },
        { icon: 'calculator-outline', label: 'Salary preview', href: '/admin/payroll/salary-preview' },
        { icon: 'document-lock-outline', label: 'Payroll policy', href: '/admin/payroll/policy' },
      ],
    },
    {
      key: 'org',
      label: 'Organisation',
      show: isSuperAdmin,
      items: [
        // In org mode the Overview "Dashboard" already opens it.
        { icon: 'globe-outline', label: 'Organisation dashboard', href: '/admin/org-dashboard', show: !isOrgMode },
        // Web ORG_MODE_GROUPS: Dashboard, Companies, Company Modules, Reports & Analytics, Organisation Profile.
        { icon: 'business-outline', label: 'Companies', href: '/admin/companies' },
        { icon: 'cube-outline', label: 'Company modules', href: '/admin/companies/modules' },
        { icon: 'bar-chart-outline', label: 'Reports & analytics', href: '/admin/org-reports' },
        { icon: 'ribbon-outline', label: 'Organisation profile', href: '/admin/organisation' },
        {
          icon: 'swap-vertical-outline',
          label: isOrgMode ? 'Pick a company' : 'Switch company',
          href: '/company-picker',
        },
      ],
    },
  ];
  return groups
    .filter((g) => g.show !== false)
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show !== false) }))
    .filter((g) => g.items.length);
}
