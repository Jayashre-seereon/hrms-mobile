import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useAccess } from '@/lib/access';
import { profileOf } from '@/store/session';
import { CompanySwitcherRow } from '@/lib/CompanyScopeNotice';
import { Card, Screen, Title } from '@/ui/components';
import { MenuRow } from '@/ui/kit';
import { useColors } from '@/ui/theme';
function Section({ title, items, hidden }) {
  const c = useColors();
  const router = useRouter();
  const visible = items.filter((i) => i.show !== false);
  if (hidden || !visible.length) return null;
  return (
    <>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 }}>
        {title}
      </Text>
      <Card style={{ paddingVertical: 0, gap: 0 }}>
        {visible.map((i) => (
          <MenuRow key={i.href} icon={i.icon} label={i.label} hint={i.hint} onPress={() => router.push(i.href)} />
        ))}
      </Card>
    </>
  );
}
export default function MoreScreen() {
  const { me, isOrgUser, hasModule } = useAccess();
  // Admin / HR account without a linked employee record: the self-service lists would answer 403 "No employee profile".
  const self = !(isOrgUser && !profileOf(me).employee_id);
  return (
    <Screen>
      <Title>More</Title>
      <CompanySwitcherRow />

      <Section
        title="Time & attendance"
        hidden={!self}
        items={[
          {
            icon: 'time-outline',
            label: 'Regularisation',
            hint: 'Missed punch-out requests',
            href: '/attendance/regularisation',
            show: hasModule('attendance'),
          },
          {
            icon: 'create-outline',
            label: 'Punch corrections',
            href: '/attendance/corrections',
            show: hasModule('attendance'),
          },
          {
            icon: 'swap-horizontal-outline',
            label: 'Comp-off',
            href: '/attendance/comp-off',
            show: hasModule('attendance'),
          },
          { icon: 'document-text-outline', label: 'Timesheets', href: '/timesheets', show: hasModule('attendance') },
          { icon: 'sunny-outline', label: 'Holidays', href: '/holidays', show: hasModule('attendance', 'leave') },
        ]}
      />

      <Section
        title="Leave"
        items={[
          {
            icon: 'checkmark-done-outline',
            label: 'Leave approvals',
            hint: 'Approve your team’s requests',
            href: '/leave/approvals',
            show: hasModule('leave'),
          },
        ]}
      />

      <Section
        title="My work"
        hidden={!self}
        items={[
          { icon: 'cash-outline', label: 'My payslips', href: '/payslips', show: hasModule('payroll') },
          { icon: 'folder-open-outline', label: 'My documents', href: '/documents', show: hasModule('documents') },
          {
            icon: 'chatbubble-ellipses-outline',
            label: 'My complaints',
            href: '/complaints',
            show: hasModule('helpdesk'),
          },
          { icon: 'people-outline', label: 'My referrals', href: '/referrals', show: hasModule('recruitment') },
          { icon: 'trending-up-outline', label: 'My movements', hint: 'Promotions & transfers', href: '/movements' },
          {
            icon: 'speedometer-outline',
            label: 'Performance indicators',
            href: '/performance',
            show: hasModule('performance'),
          },
          { icon: 'exit-outline', label: 'Resignation', href: '/resignation', show: hasModule('exit') },
        ]}
      />

      <Section
        title="Admin"
        items={[
          { icon: 'stats-chart-outline', label: 'Admin dashboard', href: '/admin', show: isOrgUser },
          {
            icon: 'id-card-outline',
            label: 'Employees',
            href: '/admin/employees',
            show: isOrgUser && hasModule('employee'),
          },
          {
            icon: 'calendar-number-outline',
            label: 'Employee attendance',
            href: '/admin/attendance',
            show: isOrgUser && hasModule('attendance'),
          },
          {
            icon: 'chatbubbles-outline',
            label: 'Grievances',
            href: '/admin/grievances',
            show: isOrgUser && hasModule('helpdesk'),
          },
          {
            icon: 'wallet-outline',
            label: 'Payroll runs',
            href: '/admin/payroll-runs',
            show: isOrgUser && hasModule('payroll'),
          },
          {
            icon: 'layers-outline',
            label: 'Masters',
            hint: 'Departments, grades, leave types…',
            href: '/admin/masters',
            show: isOrgUser,
          },
          {
            icon: 'shield-checkmark-outline',
            label: 'Roles & access',
            href: '/admin/roles',
            show: isOrgUser && hasModule('employee'),
          },
        ]}
      />
    </Screen>
  );
}
