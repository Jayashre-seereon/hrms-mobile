import { useRouter } from 'expo-router';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Card, Muted } from '@/ui/components';
import { Header, MenuRow, Page } from '@/ui/kit';
/** Compliance hub (web /org/compliance — the API-backed parts: attendance patterns, timesheet formats). */
export default function ComplianceHome() {
  const router = useRouter();
  return (
    <Page>
      <Header title="Compliance" />
      <CompanyScopeNotice />
      <Muted>Attendance patterns drive the LOP check in payroll. Timesheet formats decide what employees fill in.</Muted>
      <Card style={{ paddingVertical: 0 }}>
        <MenuRow
          icon="calendar-outline"
          label="Attendance patterns"
          hint="Working days, weekly offs and LOP per month"
          onPress={() => router.push('/admin/compliance/patterns')}
        />
        <MenuRow
          icon="time-outline"
          label="Timesheet formats"
          hint="Frequency, department and fields shown to employees"
          onPress={() => router.push('/admin/compliance/timesheet-formats')}
        />
      </Card>
    </Page>
  );
}
