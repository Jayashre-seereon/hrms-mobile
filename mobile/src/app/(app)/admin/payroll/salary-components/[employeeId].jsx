import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { personName } from '@/api/admin/common';
import { getEmployeeById } from '@/api/admin/employees';
import { getSalaryComponents, salaryPreview, saveSalaryComponents } from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toRows = (list) =>
  (list ?? []).map((x) => ({ label: x.label ?? '', amount: x.monthly_amount == null ? '' : String(x.monthly_amount), is_basic: !!x.is_basic }));
const bool = (v, fallback = true) => (v === undefined || v === null ? fallback : v === true || v === 'true' || v === 1);

/** Same rules as the server (_check_components): unique labels, exactly one basic, amounts 0 or more. */
function problemOf(rows) {
  if (!rows.length) return '';
  if (rows.some((r) => !r.label.trim())) return 'Give every component a label.';
  if (rows.some((r) => r.amount === '' || Number.isNaN(Number(r.amount)) || Number(r.amount) < 0))
    return 'Enter a monthly amount (0 or more) for every component.';
  const labels = rows.map((r) => r.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return 'Component labels must be unique.';
  if (rows.filter((r) => r.is_basic).length !== 1) return 'Exactly one component must be the basic.';
  return '';
}
const toBody = (rows) => rows.map((r) => ({ label: r.label.trim(), monthly_amount: Number(r.amount), is_basic: r.is_basic }));

/**
 * One employee's salary components: GET / PUT /payroll/employees/{id}/salary-components (PUT sends the full list,
 * needs payroll.run). "Preview" runs POST /payroll/salary-preview with these components as component_overrides.
 */
export default function SalaryComponentsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { employeeId, name } = useLocalSearchParams();
  const empId = String(employeeId ?? '');
  const { can } = useAccess();
  const canEdit = can('payroll.run');
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const q = useQuery({
    queryKey: ['admin', 'payroll-salary-components', empId],
    queryFn: () => getSalaryComponents(empId),
    enabled: !!empId,
  });
  const emp = useQuery({
    queryKey: ['admin', 'employee', empId],
    queryFn: () => getEmployeeById(empId),
    enabled: !!empId,
  });
  useEffect(() => {
    if (q.data && rows === null) setRows(toRows(q.data.components));
  }, [q.data, rows]);

  const list = rows ?? [];
  const problem = problemOf(list);
  const e = emp.data ?? {};
  const wageType = e.wage_type ?? e.wageType;
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setBasic = (i) => setRows((rs) => rs.map((r, j) => ({ ...r, is_basic: j === i })));
  const total = list.reduce((n, r) => n + (Number(r.amount) || 0), 0);

  const save = async () => {
    if (problem) return Alert.alert('Salary components', problem);
    setSaving(true);
    try {
      const next = await saveSalaryComponents(empId, toBody(list));
      qc.setQueryData(['admin', 'payroll-salary-components', empId], next);
      setRows(toRows(next?.components));
      Alert.alert('Salary components', 'Salary components saved.');
    } catch (err) {
      Alert.alert('Salary components', errorMessage(err, 'Could not save the salary components.'));
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError('');
    try {
      const daily = wageType === 'Daily';
      const amount = Number(daily ? (e.daily_rate ?? e.dailyRate) : (e.ctc ?? e.CTC));
      setPreview(
        await salaryPreview({
          wage_type: daily ? 'Daily' : 'Monthly',
          ...(daily ? { daily_rate: amount } : amount > 0 ? { ctc: amount } : {}),
          ...(!daily && list.length ? { component_overrides: toBody(list) } : {}),
          pf_applicable: bool(e.pf_applicable),
          esi_applicable: bool(e.esi_applicable),
          ...(e.pt_state ? { pt_state: e.pt_state } : {}),
        }),
      );
    } catch (err) {
      setPreview(null);
      setPreviewError(errorMessage(err, 'Could not calculate the preview.'));
    } finally {
      setPreviewing(false);
    }
  };

  const title = personName(e) || (name ? String(name) : 'Salary components');

  return (
    <Page onRefresh={() => (q.refetch(), emp.refetch())} refreshing={q.isRefetching}>
      <Header title="Salary components" />
      <Card style={{ gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
        <Muted>
          {[e.employee_code, wageType, e.ctc != null ? `CTC ${inr(e.ctc)}` : null, e.daily_rate != null ? `Daily ${inr(e.daily_rate)}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Muted>
      </Card>

      {q.isLoading || rows === null ? (
        q.error ? <ErrorText>{errorMessage(q.error, 'Could not load the salary components.')}</ErrorText> : <Loading />
      ) : (
        <>
          {wageType === 'Daily' ? (
            <Muted>This employee is on a Daily wage: components apply to Monthly-wage employees only.</Muted>
          ) : null}
          {list.length === 0 ? (
            <Muted>No components: the payroll uses a single Basic worked out from the CTC (CTC ÷ 12).</Muted>
          ) : null}
          {list.map((r, i) => (
            <Card key={i} style={{ gap: 10 }}>
              <Field label="Label" value={r.label} editable={canEdit} maxLength={150} placeholder="e.g. HRA" onChangeText={(v) => set(i, { label: v })} />
              <Field
                label="Monthly amount (₹)"
                value={r.amount}
                editable={canEdit}
                keyboardType="decimal-pad"
                onChangeText={(v) => set(i, { amount: v })}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable
                  disabled={!canEdit}
                  onPress={() => setBasic(i)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: r.is_basic }}>
                  <Ionicons name={r.is_basic ? 'radio-button-on' : 'radio-button-off'} size={20} color={c.primary} />
                  <Text style={{ color: c.text }}>Basic</Text>
                </Pressable>
                {canEdit ? (
                  <Pressable onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel="Remove component">
                    <Ionicons name="trash-outline" size={20} color={c.danger} />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
          {list.length ? (
            <Card style={{ gap: 0 }}>
              <Row label="Monthly total" value={inr(total)} />
              <Row label="Annual (× 12)" value={inr(total * 12)} />
            </Card>
          ) : null}
          {problem ? <ErrorText>{problem}</ErrorText> : null}
          {canEdit ? (
            <View style={{ gap: 10 }}>
              <Button
                title="Add component"
                variant="outline"
                onPress={() => setRows((rs) => [...rs, { label: '', amount: '', is_basic: rs.length === 0 }])}
              />
              <Button title="Save components" onPress={save} loading={saving} disabled={!!problem} />
            </View>
          ) : (
            <Muted>You can view the components. Saving needs the payroll.run permission.</Muted>
          )}
          <Button title="Preview salary" variant="outline" onPress={runPreview} loading={previewing} disabled={!!problem || emp.isLoading} />
          <ErrorText>{previewError}</ErrorText>
          {preview ? (
            <Card style={{ gap: 0 }}>
              <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>Estimate at full attendance</Text>
              <Row label="Paid days" value={preview.paid_days != null ? String(preview.paid_days) : '—'} />
              <Row label="Gross" value={inr(preview.gross)} />
              <Row label="Net take-home" value={inr(preview.net)} />
              <Row label="Employer cost" value={inr(preview.employer_cost)} />
              <Text style={{ color: c.text, fontWeight: '600', marginTop: 12 }}>Earnings</Text>
              {(preview.earnings ?? []).map((l) => (
                <Row key={`e-${l.label}`} label={l.label} value={inr(l.amount)} />
              ))}
              <Text style={{ color: c.text, fontWeight: '600', marginTop: 12 }}>Deductions</Text>
              {(preview.deductions ?? []).map((l) => (
                <Row key={`d-${l.label}`} label={l.label} value={inr(l.amount)} />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Page>
  );
}
