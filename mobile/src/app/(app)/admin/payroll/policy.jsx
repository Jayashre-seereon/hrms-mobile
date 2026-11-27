import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getPayrollPolicy, updatePayrollPolicy } from '@/api/admin/payroll';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/*
 * Per-company wage rules and statutory settings (web: PayrollPolicyTab.jsx): GET / PUT /payroll/policy.
 * PUT merges, so each form sends only its own section. Only an admin can save (others get 403).
 */
const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const str = (v) => (v === null || v === undefined ? '' : String(v));
const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

const WAGE_NUMBERS = [
  { key: 'ot_multiplier', label: 'Overtime multiplier', hint: '0 to 10. 0 pays no overtime.', show: (v) => (v === 0 ? 'No overtime' : `${v}× hourly rate`) },
  { key: 'std_days_per_month', label: 'Standard days per month', hint: 'Whole number 1 to 31. Used by the salary preview only.', show: (v) => `${v} days` },
  { key: 'std_shift_hours', label: 'Standard shift hours', hint: 'Overtime divisor when an employee has no shift (above 0, up to 24).', show: (v) => `${v} hours` },
];
const WAGE_TOGGLES = [
  { key: 'weekly_off_paid', label: 'Weekly offs are paid', hint: 'Daily workers are paid for weekly offs.' },
  { key: 'paid_holidays_paid', label: 'Paid holidays are paid', hint: 'Daily workers are paid for holidays.' },
];
const LEVEL_PERMISSIONS = [
  { value: 'payroll.run', label: 'Prepare — payroll.run (HR Manager, Payroll Admin)' },
  { value: 'payroll.approve', label: 'Approve — payroll.approve (Finance Manager)' },
  { value: 'payroll.process', label: 'Process & pay — payroll.process (Finance Manager)' },
];
const permissionLabel = (v) => LEVEL_PERMISSIONS.find((p) => p.value === v)?.label ?? v;
const RATES = [
  { key: 'pf_rate', label: 'PF rate', hint: '% of the PF wage, employee and employer.', show: pct },
  { key: 'pf_wage_cap', label: 'PF wage cap', hint: 'The PF wage is the earned basic, up to this amount.', show: inr },
  { key: 'esi_rate', label: 'ESI rate — employee', hint: '% of the earned gross.', show: pct },
  { key: 'esi_employer_rate', label: 'ESI rate — employer', hint: '% of the earned gross.', show: pct },
  { key: 'esi_gross_limit', label: 'ESI gross limit', hint: 'ESI applies while the monthly gross is at or below this.', show: inr },
];

function slabError(rows) {
  if (!rows.length) return 'Add at least one slab.';
  let last = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const { upto, amount } = rows[i];
    const isLast = i === rows.length - 1;
    if (amount === '' || Number(amount) < 0) return `Slab ${i + 1}: enter the tax amount (0 or more).`;
    if (upto === '') {
      if (!isLast) return `Slab ${i + 1}: only the last slab can have no upper limit.`;
    } else {
      if (Number(upto) <= last) return `Slab ${i + 1}: "up to" must be higher than the previous slab.`;
      last = Number(upto);
    }
  }
  return '';
}
const rowsToSlabs = (rows) =>
  rows.map((r, i) => ({ upto: i === rows.length - 1 && r.upto === '' ? null : Number(r.upto), amount: Number(r.amount || 0) }));
const slabsToRows = (slabs) => (slabs ?? []).map((s) => ({ upto: str(s.upto), amount: str(s.amount) }));
const slabText = (s) => `${s.upto === null || s.upto === undefined ? 'Above that' : `Up to ${inr(s.upto)}`} → ${inr(s.amount)}`;

function Section({ title, subtitle, action, children }) {
  const c = useColors();
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
          {subtitle ? <Muted style={{ fontSize: 12 }}>{subtitle}</Muted> : null}
        </View>
        {action}
      </View>
      {children}
    </Card>
  );
}
function LinkButton({ label, onPress, danger }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={{ color: danger ? c.danger : c.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
function Toggle({ label, hint, value, onChange }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Switch value={value} onValueChange={onChange} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text>
        {hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
      </View>
    </View>
  );
}
function EditorButtons({ saving, onSave, onCancel, disabled }) {
  return (
    <View style={{ gap: 8 }}>
      <Button title="Save" onPress={onSave} loading={saving} disabled={disabled} />
      <Button title="Cancel" variant="outline" onPress={onCancel} disabled={saving} />
    </View>
  );
}

function WageEditor({ policy, saving, onSave, onCancel }) {
  const [nums, setNums] = useState(() => Object.fromEntries(WAGE_NUMBERS.map((f) => [f.key, str(policy[f.key])])));
  const [toggles, setToggles] = useState(() => Object.fromEntries(WAGE_TOGGLES.map((f) => [f.key, policy[f.key] !== false])));
  const [minimum, setMinimum] = useState(str(policy.minimum_daily_wage));
  const submit = () => {
    const body = {};
    WAGE_NUMBERS.forEach(({ key }) => {
      if (nums[key] !== str(policy[key]) && nums[key] !== '') body[key] = Number(nums[key]);
    });
    WAGE_TOGGLES.forEach(({ key }) => {
      if (toggles[key] !== (policy[key] !== false)) body[key] = toggles[key];
    });
    if (minimum !== str(policy.minimum_daily_wage)) body.minimum_daily_wage = minimum === '' ? null : Number(minimum);
    if (!Object.keys(body).length) return onCancel();
    onSave(body, 'Wage rules saved.');
  };
  return (
    <View style={{ gap: 12 }}>
      {WAGE_NUMBERS.map((f) => (
        <View key={f.key} style={{ gap: 2 }}>
          <Field label={f.label} value={nums[f.key]} keyboardType="decimal-pad" onChangeText={(v) => setNums((x) => ({ ...x, [f.key]: v }))} />
          <Muted style={{ fontSize: 12 }}>{f.hint}</Muted>
        </View>
      ))}
      <View style={{ gap: 2 }}>
        <Field label="Minimum daily wage (₹)" value={minimum} placeholder="Not set" keyboardType="decimal-pad" onChangeText={setMinimum} />
        <Muted style={{ fontSize: 12 }}>A Daily rate below this raises a payroll warning. Empty clears it.</Muted>
      </View>
      {WAGE_TOGGLES.map((f) => (
        <Toggle key={f.key} label={f.label} hint={f.hint} value={toggles[f.key]} onChange={(v) => setToggles((x) => ({ ...x, [f.key]: v }))} />
      ))}
      <EditorButtons saving={saving} onSave={submit} onCancel={onCancel} />
    </View>
  );
}

function StatutoryEditor({ statutory, saving, onSave, onCancel }) {
  const [vals, setVals] = useState(() => Object.fromEntries(RATES.map((f) => [f.key, str(statutory[f.key])])));
  const submit = () => {
    const body = {};
    RATES.forEach(({ key }) => {
      if (vals[key] !== str(statutory[key]) && vals[key] !== '') body[key] = Number(vals[key]);
    });
    if (!Object.keys(body).length) return onCancel();
    onSave({ statutory: body }, 'Statutory settings saved.');
  };
  return (
    <View style={{ gap: 12 }}>
      {RATES.map((f) => (
        <View key={f.key} style={{ gap: 2 }}>
          <Field label={f.label} value={vals[f.key]} keyboardType="decimal-pad" onChangeText={(v) => setVals((x) => ({ ...x, [f.key]: v }))} />
          <Muted style={{ fontSize: 12 }}>{f.hint}</Muted>
        </View>
      ))}
      <EditorButtons saving={saving} onSave={submit} onCancel={onCancel} />
    </View>
  );
}

function PtEditor({ mode, state, statutory, saving, onSave, onCancel }) {
  const c = useColors();
  const isDefault = mode === 'default';
  const byState = statutory.pt_slabs_by_state ?? {};
  const [name, setName] = useState(mode === 'edit' ? state : '');
  const [rows, setRows] = useState(() =>
    isDefault ? slabsToRows(statutory.pt_slabs) : mode === 'edit' ? slabsToRows(byState[state]) : [{ upto: '', amount: '' }],
  );
  const trimmed = name.trim();
  const clash =
    !isDefault &&
    trimmed &&
    trimmed.toLowerCase() !== (state ?? '').toLowerCase() &&
    Object.keys(byState).some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const problem =
    (!isDefault && !trimmed ? 'Enter the state name.' : '') ||
    (clash ? `${trimmed} already has slabs. Edit that row instead.` : '') ||
    slabError(rows);
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const submit = () => {
    if (problem) return Alert.alert('Professional tax', problem);
    const slabs = rowsToSlabs(rows);
    if (isDefault) return onSave({ statutory: { pt_slabs: slabs } }, 'Default slabs saved.');
    // pt_slabs_by_state is replaced as a whole: send the full map with this state added, changed or renamed.
    const next = Object.fromEntries(Object.entries(byState).filter(([s]) => s !== state));
    next[trimmed] = slabs;
    onSave({ statutory: { pt_slabs_by_state: next } }, `${trimmed} slabs saved.`);
  };
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: c.text, fontWeight: '700' }}>
        {isDefault ? 'Edit default slabs' : mode === 'edit' ? `Edit ${state} slabs` : 'Add a state'}
      </Text>
      {!isDefault ? (
        <Field label="State name" value={name} placeholder="e.g. Odisha" onChangeText={setName} />
      ) : null}
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              label={i === 0 ? 'Gross up to (₹)' : ' '}
              value={r.upto}
              placeholder={i === rows.length - 1 ? 'No limit' : 'e.g. 15000'}
              keyboardType="decimal-pad"
              onChangeText={(v) => set(i, { upto: v })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={i === 0 ? 'Tax (₹)' : ' '}
              value={r.amount}
              placeholder="e.g. 200"
              keyboardType="decimal-pad"
              onChangeText={(v) => set(i, { amount: v })}
            />
          </View>
          <Pressable
            disabled={rows.length < 2}
            onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            style={{ height: 48, justifyContent: 'center', opacity: rows.length < 2 ? 0.3 : 1 }}
            accessibilityLabel="Remove slab">
            <Ionicons name="trash-outline" size={20} color={c.danger} />
          </Pressable>
        </View>
      ))}
      <Button title="Add slab" variant="outline" onPress={() => setRows((rs) => [...rs, { upto: '', amount: '' }])} />
      <Muted style={{ fontSize: 12 }}>Slabs rise by gross. Leave the last “up to” empty for no upper limit.</Muted>
      {problem && (trimmed || isDefault || rows.some((r) => r.upto !== '' || r.amount !== '')) ? (
        <ErrorText>{problem}</ErrorText>
      ) : null}
      <EditorButtons saving={saving} onSave={submit} onCancel={onCancel} />
    </View>
  );
}

function ApprovalEditor({ policy, saving, onSave, onCancel }) {
  const c = useColors();
  const [levels, setLevels] = useState(() =>
    (policy.approval_levels ?? []).map((lv) => ({ name: lv.name ?? '', permission: lv.permission ?? 'payroll.approve' })),
  );
  const [makerChecker, setMakerChecker] = useState(policy.enforce_maker_checker !== false);
  const set = (i, patch) => setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i, d) =>
    setLevels((ls) => {
      const j = i + d;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const problem = !levels.length ? 'Add at least one level.' : levels.some((l) => !l.name.trim()) ? 'Give every level a name.' : '';
  const submit = () => {
    if (problem) return Alert.alert('Approval workflow', problem);
    onSave(
      {
        approval_levels: levels.map((l, i) => ({ level_no: i + 1, name: l.name.trim(), permission: l.permission })),
        enforce_maker_checker: makerChecker,
      },
      'Approval workflow saved.',
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <Muted style={{ fontSize: 12 }}>Levels are signed in order. A run already waiting for approval follows the new levels straight away.</Muted>
      {levels.map((l, i) => (
        <View key={i} style={{ gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>Level {i + 1}</Text>
            <Pressable disabled={i === 0} onPress={() => move(i, -1)} style={{ opacity: i === 0 ? 0.3 : 1 }} accessibilityLabel="Move up">
              <Ionicons name="chevron-up" size={20} color={c.text} />
            </Pressable>
            <Pressable disabled={i === levels.length - 1} onPress={() => move(i, 1)} style={{ opacity: i === levels.length - 1 ? 0.3 : 1 }} accessibilityLabel="Move down">
              <Ionicons name="chevron-down" size={20} color={c.text} />
            </Pressable>
            <Pressable
              disabled={levels.length < 2}
              onPress={() => setLevels((ls) => ls.filter((_, j) => j !== i))}
              style={{ opacity: levels.length < 2 ? 0.3 : 1 }}
              accessibilityLabel="Remove level">
              <Ionicons name="trash-outline" size={20} color={c.danger} />
            </Pressable>
          </View>
          <Field label="Name" value={l.name} placeholder="Level name, e.g. Finance" onChangeText={(v) => set(i, { name: v })} />
          <Select label="Needs permission" value={l.permission} options={LEVEL_PERMISSIONS} onChange={(v) => set(i, { permission: v })} />
        </View>
      ))}
      <Button title="Add level" variant="outline" onPress={() => setLevels((ls) => [...ls, { name: '', permission: 'payroll.approve' }])} />
      <Toggle
        label="Preparer cannot approve"
        hint="The person who prepared a run cannot sign any level of it."
        value={makerChecker}
        onChange={setMakerChecker}
      />
      {problem ? <ErrorText>{problem}</ErrorText> : null}
      <EditorButtons saving={saving} onSave={submit} onCancel={onCancel} />
    </View>
  );
}

export default function PayrollPolicyScreen() {
  const qc = useQueryClient();
  const c = useColors();
  const { isAdmin } = useAccess();
  const [editing, setEditing] = useState(null); // { kind: 'approval' | 'wage' | 'statutory' | 'pt', mode?, state? }
  const [saving, setSaving] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'payroll-policy'], queryFn: getPayrollPolicy });
  const policy = q.data;

  const save = async (body, okMessage) => {
    setSaving(true);
    try {
      const next = await updatePayrollPolicy(body);
      qc.setQueryData(['admin', 'payroll-policy'], next);
      setEditing(null);
      Alert.alert('Payroll policy', okMessage);
    } catch (e) {
      Alert.alert(
        'Payroll policy',
        e?.response?.status === 403 ? 'Only an admin can change the payroll policy.' : errorMessage(e, 'Could not save the policy.'),
      );
    } finally {
      setSaving(false);
    }
  };
  const editLink = (kind) => (isAdmin && editing?.kind !== kind ? <LinkButton label="Edit" onPress={() => setEditing({ kind })} /> : null);
  const cancel = () => setEditing(null);

  if (q.isLoading)
    return (
      <Page>
        <Header title="Payroll policy" />
        <Loading />
      </Page>
    );
  if (q.error || !policy)
    return (
      <Page onRefresh={() => q.refetch()}>
        <Header title="Payroll policy" />
        <ErrorText>{errorMessage(q.error, 'Could not load the payroll policy.')}</ErrorText>
        <Button title="Retry" variant="outline" onPress={() => q.refetch()} />
      </Page>
    );

  const st = policy.statutory ?? {};
  const byState = Object.entries(st.pt_slabs_by_state ?? {});

  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Payroll policy" />
      <CompanyScopeNotice />
      {!isAdmin ? <Muted>You can view the policy. Only an admin can change it.</Muted> : null}

      <Section title="Approval workflow" subtitle="Who must sign a payroll run, in order, before it can be processed." action={editLink('approval')}>
        {editing?.kind === 'approval' ? (
          <ApprovalEditor policy={policy} saving={saving} onSave={save} onCancel={cancel} />
        ) : (
          <View>
            {(policy.approval_levels ?? []).map((lv) => (
              <Row key={lv.level_no} label={`${lv.level_no}. ${lv.name}`} value={permissionLabel(lv.permission)} />
            ))}
            <Row label="Preparer cannot approve" value={policy.enforce_maker_checker !== false ? 'On' : 'Off'} />
          </View>
        )}
      </Section>

      <Section title="Wage rules" subtitle="How Daily-wage workers are paid, and the defaults the salary preview uses." action={editLink('wage')}>
        {editing?.kind === 'wage' ? (
          <WageEditor policy={policy} saving={saving} onSave={save} onCancel={cancel} />
        ) : (
          <View>
            {WAGE_NUMBERS.map((f) => (
              <Row key={f.key} label={f.label} value={policy[f.key] === null || policy[f.key] === undefined ? '—' : f.show(policy[f.key])} />
            ))}
            <Row
              label="Minimum daily wage"
              value={policy.minimum_daily_wage === null || policy.minimum_daily_wage === undefined ? 'Not set' : inr(policy.minimum_daily_wage)}
            />
            {WAGE_TOGGLES.map((f) => (
              <Row key={f.key} label={f.label} value={policy[f.key] !== false ? 'Yes' : 'No'} />
            ))}
          </View>
        )}
      </Section>

      <Section title="Statutory settings" subtitle="PF and ESI rates and limits for this company." action={editLink('statutory')}>
        {editing?.kind === 'statutory' ? (
          <StatutoryEditor statutory={st} saving={saving} onSave={save} onCancel={cancel} />
        ) : (
          <View>
            {RATES.map((f) => (
              <Row key={f.key} label={f.label} value={f.show(st[f.key])} />
            ))}
          </View>
        )}
      </Section>

      <Section
        title="Professional tax"
        subtitle="An employee's PT state picks the slabs. No state, or a state not listed here, uses the default slabs."
        action={isAdmin && editing?.kind !== 'pt' ? <LinkButton label="Add state" onPress={() => setEditing({ kind: 'pt', mode: 'add' })} /> : null}>
        {editing?.kind === 'pt' ? (
          <PtEditor mode={editing.mode} state={editing.state} statutory={st} saving={saving} onSave={save} onCancel={cancel} />
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>Default</Text>
                {isAdmin ? <LinkButton label="Edit" onPress={() => setEditing({ kind: 'pt', mode: 'default' })} /> : null}
              </View>
              <Muted style={{ fontSize: 12 }}>No state, or a state not listed</Muted>
              {(st.pt_slabs ?? []).map((s, i) => (
                <Muted key={i} style={{ fontSize: 13 }}>
                  {slabText(s)}
                </Muted>
              ))}
            </View>
            {byState.length === 0 ? (
              <Muted style={{ fontSize: 12 }}>No state-specific slabs yet. The default slabs apply to every employee.</Muted>
            ) : null}
            {byState.map(([state, slabs]) => (
              <View key={state} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{state}</Text>
                  {isAdmin ? (
                    <>
                      <LinkButton label="Edit" onPress={() => setEditing({ kind: 'pt', mode: 'edit', state })} />
                      <LinkButton
                        label="Remove"
                        danger
                        onPress={() =>
                          Alert.alert('Remove slabs', `Remove the ${state} slabs? Employees in ${state} will use the default slabs.`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: () => {
                                const rest = Object.fromEntries(byState.filter(([s]) => s !== state));
                                save({ statutory: { pt_slabs_by_state: rest } }, `${state} slabs removed.`);
                              },
                            },
                          ])
                        }
                      />
                    </>
                  ) : null}
                </View>
                {(slabs ?? []).map((s, i) => (
                  <Muted key={i} style={{ fontSize: 13 }}>
                    {slabText(s)}
                  </Muted>
                ))}
              </View>
            ))}
          </View>
        )}
      </Section>
    </Page>
  );
}
