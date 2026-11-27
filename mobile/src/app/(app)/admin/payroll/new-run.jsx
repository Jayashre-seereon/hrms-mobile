import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { createPayrollRun, listPayrollRuns } from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Button, Card, Muted } from '@/ui/components';
import { DateField, Header, Page, Select } from '@/ui/kit';

const pad = (n) => String(n).padStart(2, '0');
const periodOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const lastDayOf = (period) => {
  const [y, m] = period.split('-').map(Number);
  return `${period}-${pad(new Date(y, m, 0).getDate())}`;
};
const monthLabel = (period) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Create a payroll run (web: PayrollRunsTab create card). POST /payroll/runs { period, pay_date }.
 * Like the web, an existing run for the month is opened instead of creating a second one.
 */
export default function NewPayrollRunScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAccess();
  const [period, setPeriod] = useState(periodOf(new Date()));
  const [payDate, setPayDate] = useState(lastDayOf(periodOf(new Date())));
  const [busy, setBusy] = useState(false);
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 15 }, (_, i) => {
      const p = periodOf(new Date(now.getFullYear(), now.getMonth() + 1 - i, 1));
      return { label: monthLabel(p), value: p };
    });
  }, []);

  const open = (id) => router.replace(`/admin/payroll-runs/${encodeURIComponent(String(id))}`);
  const create = async () => {
    setBusy(true);
    try {
      const existing = await listPayrollRuns({ period, page: 1, limit: 20 });
      const found = existing.find((r) => r.period === period);
      if (found) {
        Alert.alert('Payroll', `Payroll for ${found.period} already exists. Opened the existing run.`);
        open(found.id);
        return;
      }
      const run = await createPayrollRun({ period, pay_date: payDate });
      qc.invalidateQueries({ queryKey: ['admin', 'payroll-runs'] });
      Alert.alert('Payroll', `Payroll run for ${run.period ?? period} created.`);
      open(run.id);
    } catch (e) {
      Alert.alert('Payroll', errorMessage(e, 'Could not create the payroll run.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Header title="New payroll run" />
      <CompanyScopeNotice />
      {!can('payroll.run') ? (
        <Muted>You need the payroll.run permission to create a payroll run.</Muted>
      ) : (
        <Card style={{ gap: 14 }}>
          <Select
            label="Period"
            value={period}
            options={months}
            onChange={(p) => {
              setPeriod(p);
              setPayDate(lastDayOf(p));
            }}
          />
          <DateField label="Pay date" value={payDate} onChange={setPayDate} />
          <Muted style={{ fontSize: 12 }}>
            Lock the month’s attendance first (Attendance → Payroll attendance lock). The server calculates every
            employee’s pay; run the checks on the new run next.
          </Muted>
          <Button title="Create payroll run" onPress={create} loading={busy} disabled={!period || !payDate} />
        </Card>
      )}
    </Page>
  );
}
