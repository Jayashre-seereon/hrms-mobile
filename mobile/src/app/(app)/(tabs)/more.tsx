import Ionicons from '@expo/vector-icons/Ionicons';
import { Href, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { useAccess } from '@/lib/access';
import { Card, Screen, Title } from '@/ui/components';
import { MenuRow } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string; href: string; show?: boolean };

function Section({ title, items }: { title: string; items: Item[] }) {
  const c = useColors();
  const router = useRouter();
  const visible = items.filter((i) => i.show !== false);
  if (!visible.length) return null;
  return (
    <>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 }}>{title}</Text>
      <Card style={{ paddingVertical: 0, gap: 0 }}>
        {visible.map((i) => (
          <MenuRow key={i.href} icon={i.icon} label={i.label} hint={i.hint} onPress={() => router.push(i.href as Href)} />
        ))}
      </Card>
    </>
  );
}

export default function MoreScreen() {
  const { isOrgUser, hasModule } = useAccess();

  return (
    <Screen>
      <Title>More</Title>

      <Section
        title="Time & attendance"
        items={[
          { icon: 'time-outline', label: 'Regularisation', hint: 'Missed punch-out requests', href: '/attendance/regularisation' },
          { icon: 'create-outline', label: 'Punch corrections', href: '/attendance/corrections' },
          { icon: 'swap-horizontal-outline', label: 'Comp-off', href: '/attendance/comp-off' },
          { icon: 'document-text-outline', label: 'Timesheets', href: '/timesheets' },
          { icon: 'sunny-outline', label: 'Holidays', href: '/holidays' },
        ]}
      />

      <Section
        title="Leave"
        items={[
          { icon: 'checkmark-done-outline', label: 'Leave approvals', hint: 'Approve your team’s requests', href: '/leave/approvals' },
        ]}
      />

      <Section
        title="My work"
        items={[
          { icon: 'cash-outline', label: 'My payslips', href: '/payslips' },
          { icon: 'folder-open-outline', label: 'My documents', href: '/documents' },
          { icon: 'chatbubble-ellipses-outline', label: 'My complaints', href: '/complaints' },
          { icon: 'people-outline', label: 'My referrals', href: '/referrals' },
          { icon: 'trending-up-outline', label: 'My movements', hint: 'Promotions & transfers', href: '/movements' },
          { icon: 'speedometer-outline', label: 'Performance indicators', href: '/performance' },
          { icon: 'exit-outline', label: 'Resignation', href: '/resignation' },
        ]}
      />

      <Section
        title="Admin"
        items={[
          { icon: 'stats-chart-outline', label: 'Admin dashboard', href: '/admin', show: isOrgUser },
          { icon: 'id-card-outline', label: 'Employees', href: '/admin/employees', show: isOrgUser && hasModule('employee') },
          { icon: 'calendar-number-outline', label: 'Employee attendance', href: '/admin/attendance', show: isOrgUser && hasModule('attendance') },
          { icon: 'chatbubbles-outline', label: 'Grievances', href: '/admin/grievances', show: isOrgUser },
          { icon: 'wallet-outline', label: 'Payroll runs', href: '/admin/payroll-runs', show: isOrgUser && hasModule('payroll') },
          { icon: 'layers-outline', label: 'Masters', hint: 'Departments, grades, leave types…', href: '/admin/masters', show: isOrgUser },
          { icon: 'shield-checkmark-outline', label: 'Roles & access', href: '/admin/roles', show: isOrgUser },
        ]}
      />
    </Screen>
  );
}
