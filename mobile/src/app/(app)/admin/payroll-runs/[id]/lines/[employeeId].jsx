import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { getPayrollLine, getPayrollRun, shareEmployeePayslipPdf } from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Loading, Muted, Row } from '@/ui/components';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const money = (v) =>
  v == null || v === '' || Number.isNaN(Number(v))
    ? '—'
    : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One employee's payslip working on a run (web: LineDrawer) + their salary slip PDF once slips are available. */
export default function PayrollLineScreen() {
  const c = useColors();
  const { id, employeeId } = useLocalSearchParams();
  const runId = String(id ?? '');
  const empId = String(employeeId ?? '');
  const [downloading, setDownloading] = useState(false);
  const line = useQuery({
    queryKey: ['admin', 'payroll-line', runId, empId],
    queryFn: () => getPayrollLine(runId, empId),
    enabled: !!runId && !!empId,
  });
  // Run header (status / period) — reuses the cached detail when there is one.
  const runQ = useQuery({
    queryKey: ['admin', 'payroll-run', runId, '', 'all'],
    queryFn: () => getPayrollRun(runId, { q: '', state: 'all' }),
    enabled: !!runId,
  });
  const run = runQ.data ?? {};
  const l = line.data ?? {};
  // Web: the per-employee PDF is offered once the run is Paid or its slips were published.
  const slipsAvailable = run.status === 'Paid' || Boolean(run.payslips_published_at || run.payslips_published);

  const Items = ({ items }) =>
    (items ?? []).length ? (
      items.map((i, idx) => <Row key={`${i.label}-${idx}`} label={i.label} value={money(i.amount)} />)
    ) : (
      <Muted>—</Muted>
    );

  return (
    <Page onRefresh={() => line.refetch()} refreshing={line.isRefetching}>
      <Header title={l.employee_name ? l.employee_name : 'Payslip working'} />
      {line.isLoading ? (
        <Loading />
      ) : line.error ? (
        <ErrorText>{errorMessage(line.error, 'Could not load this employee’s working.')}</ErrorText>
      ) : (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>
              {l.employee_name} · {l.employee_code}
            </Text>
            <Muted>{[l.department, l.branch_name, l.wage_type, run.period].filter(Boolean).join(' · ')}</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(l.attendance ?? {}).map(([k, v]) => (
                <Badge key={k} label={`${k.replace(/_/g, ' ')} · ${v}`} tone="muted" />
              ))}
              <Badge
                label={`LOP ${l.lop?.days ?? 0} d (${money(l.lop?.amount)}) · payable ${l.lop?.payable_days ?? '—'}`}
                tone="warning"
              />
            </View>
          </Card>

          <Card style={{ gap: 0 }}>
            <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>Earnings</Text>
            <Items items={l.earnings} />
            {Number(l.overtime_amount ?? l.ot_amount) > 0 ? (
              <Row label="Overtime" value={money(l.overtime_amount ?? l.ot_amount)} />
            ) : null}
            <Row label="Gross" value={money(l.earned_gross ?? l.gross)} />
          </Card>

          <Card style={{ gap: 0 }}>
            <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>Deductions</Text>
            <Items items={l.deductions} />
            <Row label="Total deductions" value={money(l.total_deductions)} />
          </Card>

          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Net pay</Text>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{money(l.net)}</Text>
          </Card>

          <Card style={{ gap: 0 }}>
            <Row label="Employer cost" value={money(l.employer_cost)} />
            <Row label="Bank" value={l.bank?.bank_name} />
            <Row label="Account" value={l.bank?.account_no} />
            <Row label="IFSC" value={l.bank?.ifsc} />
          </Card>

          {slipsAvailable ? (
            <Button
              title="Download payslip PDF"
              loading={downloading}
              onPress={async () => {
                setDownloading(true);
                try {
                  await shareEmployeePayslipPdf(runId, empId, { period: run.period, code: l.employee_code });
                } catch (e) {
                  Alert.alert('Payslip', errorMessage(e, `Could not download the payslip for ${l.employee_name ?? 'this employee'}.`));
                } finally {
                  setDownloading(false);
                }
              }}
            />
          ) : (
            <Muted>The payslip PDF is available once the run is paid or its salary slips are published.</Muted>
          )}
        </>
      )}
    </Page>
  );
}
