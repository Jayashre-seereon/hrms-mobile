import { Stack } from 'expo-router';
import { SideMenu } from '@/ui/SideMenu';
import { useColors } from '@/ui/theme';

/** Known screen titles (shown at once, before the screen's own <Header> sets its title). */
const TITLES = {
  admin: 'Admin dashboard',
  'admin/org-dashboard': 'Organisation dashboard',
  'admin/org-reports': 'Reports & Analytics',
  'admin/companies': 'Companies',
  'admin/companies/form': 'Company',
  'admin/companies/modules': 'Company modules',
  'admin/organisation': 'Organisation profile',
  'admin/masters': 'Master data',
  'admin/roles': 'Roles & permissions',
  'admin/employees': 'Employees',
  'admin/employees/new': 'New employee',
  'admin/employees/edit': 'Edit employee',
  'admin/employees/import': 'Import employees',
  'admin/attendance': 'Employee attendance',
  'admin/attendance-reports': 'Attendance reports',
  'admin/attendance-locks': 'Payroll attendance lock',
  'admin/payroll-runs': 'Payroll runs',
  'admin/payroll/new-run': 'New payroll run',
  'admin/payroll/adjustments': 'Payroll adjustments',
  'admin/payroll/policy': 'Payroll policy',
  'admin/payroll/salary-components': 'Salary components',
  'admin/payroll/salary-preview': 'Salary preview',
  'admin/compliance': 'Compliance',
  'admin/cases': 'Lifecycle cases',
  'admin/delegations': 'Role delegation',
  'admin/settings': 'Settings',
  'admin/referrals': 'Referrals',
  'admin/grievances': 'Grievances',
  'company-picker': 'Select company',
  'leave/apply': 'Apply leave',
  'leave/approvals': 'Leave approvals',
  'timesheets/approvals': 'Timesheet approvals',
  'movements/manage': 'Promotions',
  'attendance/history': 'Attendance history',
  'attendance/punches': 'My punches',
};
const SEGMENT = { new: 'New', edit: 'Edit', form: 'Details', '[id]': 'Details', index: '' };
/** "admin/companies/index" → "Companies"; "[type]/[id]" → "Details" — never the raw file path. */
function titleOf(name) {
  const route = name.replace(/\/index$/, '');
  if (TITLES[route]) return TITLES[route];
  const parts = route.split('/').filter((x) => x && x !== 'index');
  const last = parts[parts.length - 1] ?? '';
  if (SEGMENT[last] !== undefined) return SEGMENT[last] || 'Details';
  if (/^\[.*\]$/.test(last)) return 'Details';
  return last.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
/**
 * Signed-in area: bottom tabs + every module screen pushed on top of them.
 * Module screens set their own title with <Stack.Screen options={{ title }} /> (see ui/components → Header).
 */
export default function AppLayout() {
  const c = useColors();
  return (
    <>
      <Stack
        screenOptions={({ route }) => ({
          title: titleOf(route.name),
          headerShown: true,
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        })}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* Web-style sidebar, opened from the ☰ button or the Menu tab. */}
      <SideMenu />
    </>
  );
}
