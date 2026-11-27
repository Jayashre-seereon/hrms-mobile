import { useQuery } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';

import { employeeIdOf, getMyPayslipMonths, money, PayslipMonth } from '@/api/payslips';
import { useSession } from '@/store/session';
import { Muted } from '@/ui/components';
import { Header, ItemCard, QueryList } from '@/ui/kit';

export default function PayslipsScreen() {
  const router = useRouter();
  const employeeId = employeeIdOf(useSession((s) => s.me));

  const months = useQuery({
    queryKey: ['payslips', 'months', employeeId],
    queryFn: () => getMyPayslipMonths(employeeId),
    enabled: Boolean(employeeId),
  });

  return (
    <>
      <Header title="My payslips" />
      {!employeeId ? (
        <Muted style={{ padding: 16 }}>Your login is not linked to an employee record, so payslips cannot be loaded.</Muted>
      ) : (
        <QueryList<PayslipMonth>
          query={months}
          keyOf={(m) => m.month}
          empty="No payslips yet. They appear after HR publishes them for a processed payroll."
          header={<Muted>Salary slips published by HR after payroll payment.</Muted>}
          renderItem={(m) => (
            <ItemCard
              title={m.label || m.month}
              lines={[m.net_pay != null ? `Net pay ${money(m.net_pay)}` : null]}
              onPress={() =>
                router.push({ pathname: '/payslips/[id]', params: { id: m.month, label: m.label ?? '', net: String(m.net_pay ?? '') } } as unknown as Href)
              }
            />
          )}
        />
      )}
    </>
  );
}
