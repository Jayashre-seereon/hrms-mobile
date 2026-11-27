import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { salaryPreview } from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Button, Card, ErrorText, Field, Muted, Row } from '@/ui/components';
import { Header, Page, Segments } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Result of POST /payroll/salary-preview (web: SalaryPreviewPanel). */
function PreviewResult({ data }) {
  const c = useColors();
  if (!data) return null;
  return (
    <Card style={{ gap: 0 }}>
      <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>Estimate at full attendance</Text>
      <Row label="Paid days" value={data.paid_days != null ? String(data.paid_days) : '—'} />
      <Row label="Gross" value={inr(data.gross)} />
      <Row label="Net take-home" value={inr(data.net)} />
      <Row label="Employer cost" value={inr(data.employer_cost)} />
      <Text style={{ color: c.text, fontWeight: '600', marginTop: 12 }}>Earnings</Text>
      {(data.earnings ?? []).map((l) => (
        <Row key={`e-${l.label}`} label={l.label} value={inr(l.amount)} />
      ))}
      <Text style={{ color: c.text, fontWeight: '600', marginTop: 12 }}>Deductions</Text>
      {(data.deductions ?? []).length === 0 ? <Muted>—</Muted> : null}
      {(data.deductions ?? []).map((l) => (
        <Row key={`d-${l.label}`} label={l.label} value={inr(l.amount)} />
      ))}
    </Card>
  );
}

/**
 * Salary preview: what an employee on these terms earns in a month of full attendance, by the same arithmetic as
 * a payroll run. POST /payroll/salary-preview (needs payroll.view). Nothing is saved.
 */
export default function SalaryPreviewScreen() {
  const c = useColors();
  const [wageType, setWageType] = useState('Monthly');
  const [amount, setAmount] = useState('');
  const [pf, setPf] = useState(true);
  const [esi, setEsi] = useState(true);
  const [ptState, setPtState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const value = Number(amount);
  const ready = value > 0;

  const calculate = async () => {
    setBusy(true);
    setError('');
    try {
      setData(
        await salaryPreview({
          wage_type: wageType,
          ...(wageType === 'Daily' ? { daily_rate: value } : { ctc: value }),
          pf_applicable: pf,
          esi_applicable: esi,
          ...(ptState.trim() ? { pt_state: ptState.trim() } : {}),
        }),
      );
    } catch (e) {
      setData(null);
      setError(
        e?.response?.status === 403
          ? 'You need the payroll.view permission for the salary preview.'
          : errorMessage(e, 'Could not calculate the preview.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Header title="Salary preview" />
      <CompanyScopeNotice />
      <Card style={{ gap: 12 }}>
        <Segments
          value={wageType}
          onChange={(v) => {
            setWageType(v);
            setData(null);
          }}
          options={[
            { label: 'Monthly', value: 'Monthly' },
            { label: 'Daily', value: 'Daily' },
          ]}
        />
        <Field
          label={wageType === 'Daily' ? 'Daily rate (₹)' : 'Annual CTC (₹)'}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder={wageType === 'Daily' ? 'e.g. 700' : 'e.g. 600000'}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Switch value={pf} onValueChange={setPf} />
          <Text style={{ color: c.text }}>PF applicable</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Switch value={esi} onValueChange={setEsi} />
          <Text style={{ color: c.text }}>ESI applicable</Text>
        </View>
        <Field label="Professional tax state (optional)" value={ptState} onChangeText={setPtState} placeholder="e.g. Odisha" />
        <Button title="Calculate" onPress={calculate} loading={busy} disabled={!ready} />
        {wageType === 'Daily' ? (
          <Muted style={{ fontSize: 12 }}>A Daily worker is paid the company’s standard days per month, with no overtime.</Muted>
        ) : null}
      </Card>
      <ErrorText>{error}</ErrorText>
      <PreviewResult data={data} />
    </Page>
  );
}
