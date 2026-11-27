import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { personName } from '@/api/admin/common';
import { getEmployees } from '@/api/admin/employees';
import {
  EDITABLE,
  addAdjustment,
  getPayrollRun,
  listAdjustments,
  listPayrollRuns,
  removeAdjustment,
} from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Button, Card, ErrorText, Field, Loading, Muted } from '@/ui/components';
import { Badge, Header, Page, Segments, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const pad = (n) => String(n).padStart(2, '0');
const periodOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const money = (v) =>
  v == null || v === '' || Number.isNaN(Number(v))
    ? '—'
    : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Bottom-sheet employee picker: the run's employees when there is a run, else GET /employees search. */
function EmployeePicker({ visible, lines, onPick, onClose }) {
  const c = useColors();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const remote = useQuery({
    queryKey: ['admin', 'payroll-adj-employees', search],
    queryFn: () => getEmployees({ page: 1, limit: 50, search }),
    enabled: visible && !lines,
  });
  const options = useMemo(() => {
    if (lines) {
      const s = search.toLowerCase();
      return lines
        .filter((l) => !s || `${l.employee_name} ${l.employee_code}`.toLowerCase().includes(s))
        .map((l) => ({ id: String(l.employee_id), name: l.employee_name, code: l.employee_code }));
    }
    return (remote.data?.items ?? []).map((e) => ({ id: String(e.id), name: personName(e), code: e.employee_code }));
  }, [lines, search, remote.data]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0006' }} onPress={onClose} />
      <View style={{ backgroundColor: c.card, padding: 16, paddingBottom: 32, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 10 }}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Select employee</Text>
        <Field label="Search" value={text} onChangeText={setText} placeholder="Name or code" autoCapitalize="none" />
        <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
          {!lines && remote.isLoading ? <Loading /> : null}
          {options.length === 0 && !(remote.isLoading && !lines) ? <Muted>No employees found.</Muted> : null}
          {options.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => onPick(o)}
              style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: c.border }}>
              <Text style={{ color: c.text, fontSize: 15 }}>
                {o.name || 'Employee'} {o.code ? `(${o.code})` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Payroll adjustments for a month (web: PayrollRunsTab → AdjustmentsDialog).
 * GET / POST / DELETE /payroll/adjustments. Opened from a run (`runId`) or on its own with a month picker.
 */
export default function PayrollAdjustmentsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { runId } = useLocalSearchParams();
  const { can } = useAccess();
  const [period, setPeriod] = useState(periodOf(new Date()));
  const [picker, setPicker] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('earning');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // The run: the one we were opened from, else the run of the selected month (if any).
  const runQ = useQuery({
    queryKey: ['admin', 'payroll-adj-run', runId ? String(runId) : `period:${period}`],
    queryFn: async () => {
      if (runId) return getPayrollRun(String(runId));
      const found = (await listPayrollRuns({ period, limit: 20 })).find((r) => r.period === period);
      return found ? getPayrollRun(String(found.id)) : null;
    },
  });
  const run = runQ.data ?? null;
  const activePeriod = runId ? run?.period : period;
  const adj = useQuery({
    queryKey: ['admin', 'payroll-adjustments', activePeriod],
    queryFn: () => listAdjustments({ period: activePeriod }),
    enabled: !!activePeriod,
  });
  const lines = run && Array.isArray(run.lines) && run.lines.length ? run.lines : null;
  const nameOf = (empId) => {
    const l = (run?.lines ?? []).find((x) => String(x.employee_id) === String(empId));
    return l ? `${l.employee_name} (${l.employee_code})` : employee?.id === String(empId) ? employee.name : empId;
  };
  const editable = can('payroll.run') && (!run || EDITABLE.includes(run.status));
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 15 }, (_, i) => {
      const p = periodOf(new Date(now.getFullYear(), now.getMonth() + 1 - i, 1));
      return { label: p, value: p };
    });
  }, []);
  const valid = employee && label.trim() && amount !== '' && Number(amount) >= 0 && !Number.isNaN(Number(amount));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'payroll-adjustments'] });
    qc.invalidateQueries({ queryKey: ['admin', 'payroll-run'] });
  };
  const add = async () => {
    setBusy(true);
    try {
      await addAdjustment({ period: activePeriod, employee_id: employee.id, label: label.trim(), kind, amount: Number(amount) });
      setEmployee(null);
      setLabel('');
      setKind('earning');
      setAmount('');
      refresh();
      Alert.alert('Adjustments', 'Adjustment added — run checks to recalculate.');
    } catch (e) {
      Alert.alert('Adjustments', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = (a) =>
    Alert.alert('Remove adjustment', `Remove “${a.label}” (${money(a.amount)})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAdjustment(a.id);
            refresh();
          } catch (e) {
            Alert.alert('Adjustments', errorMessage(e));
          }
        },
      },
    ]);

  return (
    <Page onRefresh={() => (runQ.refetch(), adj.refetch())} refreshing={adj.isRefetching}>
      <Header title={activePeriod ? `Adjustments · ${activePeriod}` : 'Adjustments'} />
      <CompanyScopeNotice />
      {!runId ? <Select label="Month" value={period} options={months} onChange={setPeriod} /> : null}
      {run ? (
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Muted>Payroll run {run.period}</Muted>
          <Badge label={run.status} />
        </Card>
      ) : null}

      {editable && activePeriod ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Add adjustment</Text>
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Employee</Text>
            <Pressable
              onPress={() => setPicker(true)}
              style={{
                height: 48,
                borderWidth: 1,
                borderRadius: 12,
                borderColor: c.border,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Text style={{ color: employee ? c.text : c.muted, fontSize: 16, flex: 1 }} numberOfLines={1}>
                {employee ? `${employee.name}${employee.code ? ` (${employee.code})` : ''}` : 'Select employee'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={c.muted} />
            </Pressable>
          </View>
          <Field label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Bonus" maxLength={150} />
          <Segments
            value={kind}
            onChange={setKind}
            options={[
              { label: 'Earning', value: 'earning' },
              { label: 'Deduction', value: 'deduction' },
            ]}
          />
          <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Button title="Add" onPress={add} loading={busy} disabled={!valid} />
        </Card>
      ) : run && !EDITABLE.includes(run.status) ? (
        <Muted>The {run.period} run is {run.status}: adjustments are closed.</Muted>
      ) : null}

      {adj.isLoading ? (
        <Loading />
      ) : adj.error ? (
        <ErrorText>{errorMessage(adj.error, 'Could not load adjustments.')}</ErrorText>
      ) : (adj.data ?? []).length === 0 ? (
        <Muted>No adjustments for this month.</Muted>
      ) : (
        (adj.data ?? []).map((a) => (
          <Card key={String(a.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>
                {a.label} <Text style={{ color: c.muted, fontSize: 12 }}>· {a.kind}</Text>
              </Text>
              <Muted style={{ fontSize: 12 }}>{nameOf(a.employee_id)}</Muted>
            </View>
            <Text style={{ color: a.kind === 'deduction' ? c.danger : c.text, fontWeight: '700' }}>{money(a.amount)}</Text>
            {editable ? (
              <Pressable onPress={() => remove(a)} hitSlop={10} accessibilityLabel="Remove">
                <Ionicons name="trash-outline" size={20} color={c.danger} />
              </Pressable>
            ) : null}
          </Card>
        ))
      )}

      <EmployeePicker
        visible={picker}
        lines={lines}
        onClose={() => setPicker(false)}
        onPick={(o) => {
          setEmployee(o);
          setPicker(false);
        }}
      />
    </Page>
  );
}
