import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMySummary, getTodayStatus } from '@/api/attendance';
import { loadEmployeeHolidays } from '@/api/holidays';
import { getMyBalances } from '@/api/leave';
import { errorMessage } from '@/lib/api';
import { isOrgUser, useAccess } from '@/lib/access';
import { CompanySwitcherRow } from '@/lib/CompanyScopeNotice';
import { displayName, profileOf, useSession } from '@/store/session';
import { Button, ErrorText, Loading, Muted } from '@/ui/components';
import { Hero, Pill, Progress, QuickAction, SectionHeader, StatTile } from '@/ui/dashboard';
import { fmtTime } from '@/ui/format';
import { isNoEmployeeProfile } from '@/ui/NoEmployeeProfile';
import { useColors } from '@/ui/theme';

/** User id that was already sent to the admin dashboard once (like the web's redirect_portal after sign-in). */
let landedAdminFor = null;
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const hours = (v) => (num(v) == null ? null : `${Number(v).toFixed(1)}h`);

function Clock() {
  const c = useColors();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={{ color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: 0.5 }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </Text>
  );
}

/** Card surface used on the dashboard (soft shadow like the web's shadow-card). */
function Panel({ children, style }) {
  const c = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.primaryDark }, style]}>
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const c = useColors();
  const router = useRouter();
  const { hasModule } = useAccess();
  const me = useSession((s) => s.me);
  const p = profileOf(me);
  // Web: an admin / HR account goes to the admin portal and never calls the self-service APIs.
  const adminOnly = isOrgUser(me) && !p.employee_id;
  useEffect(() => {
    if (adminOnly && me?.id && landedAdminFor !== me.id) {
      landedAdminFor = me.id;
      router.push('/admin');
    }
  }, [adminOnly, me?.id, router]);

  // Light status bar text over the emerald hero, only while this tab is on screen.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('auto');
    }, []),
  );
  const self = !adminOnly;
  const today = useQuery({ queryKey: ['attendance', 'today'], queryFn: getTodayStatus, enabled: self });
  const summary = useQuery({ queryKey: ['attendance', 'my-summary'], queryFn: () => getMySummary(), enabled: self });
  const balances = useQuery({
    queryKey: ['leave', 'balances', 'me'],
    queryFn: () => getMyBalances(),
    enabled: self && hasModule('leave'),
  });
  const holidays = useQuery({
    queryKey: ['holidays', 'employee'],
    queryFn: () => loadEmployeeHolidays(),
    enabled: self && hasModule('attendance', 'leave'),
  });
  const queries = self
    ? [
        today,
        summary,
        ...(hasModule('leave') ? [balances] : []),
        ...(hasModule('attendance', 'leave') ? [holidays] : []),
      ]
    : [];
  const refreshing = queries.some((q) => q.isRefetching);
  const onRefresh = () => queries.forEach((q) => q.refetch());

  // Like the web dashboard: no linked employee record (403 "No employee profile") → empty values, no error.
  const noProfile = isNoEmployeeProfile(today.error) || isNoEmployeeProfile(summary.error);
  const todayError = isNoEmployeeProfile(today.error) ? null : today.error;
  const t = today.data;
  const s = summary.data;
  const punchedIn = Boolean(t?.is_punched_in);
  const lastOut = [...(t?.today_punches ?? [])].reverse().find((x) => x.out_time);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = (holidays.data ?? []).filter((h) => h.date >= todayIso).slice(0, 3);
  const leaveLines = (balances.data ?? [])
    .map((b) => {
      const total = num(b.entitled ?? b.total ?? b.allocated);
      const available = num(b.available ?? b.balance);
      const used = num(b.used) ?? (total != null && available != null ? total - available : null);
      return { name: b.leave_type_name ?? b.type ?? b.leave_type ?? b.code ?? 'Leave', total, available, used };
    })
    .filter((b) => b.total != null || b.available != null)
    .slice(0, 6);

  const actions = [
    { icon: 'airplane-outline', label: 'Apply leave', href: '/leave/apply', tone: 'primary', show: hasModule('leave') },
    {
      icon: 'calendar-outline',
      label: 'History',
      href: '/attendance/history',
      tone: 'info',
      show: hasModule('attendance'),
    },
    {
      icon: 'time-outline',
      label: 'Regularise',
      href: '/attendance/regularisation',
      tone: 'orange',
      show: hasModule('attendance'),
    },
    {
      icon: 'document-text-outline',
      label: 'Timesheets',
      href: '/timesheets',
      tone: 'violet',
      show: hasModule('attendance'),
    },
    { icon: 'cash-outline', label: 'Payslips', href: '/payslips', tone: 'gold', show: hasModule('payroll') },
    {
      icon: 'sunny-outline',
      label: 'Holidays',
      href: '/holidays',
      tone: 'warning',
      show: hasModule('attendance', 'leave'),
    },
    { icon: 'folder-open-outline', label: 'Documents', href: '/documents', tone: 'info', show: hasModule('documents') },
    {
      icon: 'chatbubble-ellipses-outline',
      label: 'Grievance',
      href: '/complaints',
      tone: 'danger',
      show: hasModule('helpdesk'),
    },
  ].filter((a) => a.show);
  const adminActions = [
    { icon: 'stats-chart-outline', label: 'Admin dashboard', href: '/admin', tone: 'primary' },
    { icon: 'people-outline', label: 'Employees', href: '/admin/employees', tone: 'info', show: hasModule('employee') },
    {
      icon: 'calendar-number-outline',
      label: 'Attendance',
      href: '/admin/attendance',
      tone: 'orange',
      show: hasModule('attendance'),
    },
    {
      icon: 'checkmark-done-outline',
      label: 'Leave approvals',
      href: '/leave/approvals',
      tone: 'violet',
      show: hasModule('leave'),
    },
    { icon: 'wallet-outline', label: 'Payroll', href: '/admin/payroll-runs', tone: 'gold', show: hasModule('payroll') },
    { icon: 'layers-outline', label: 'Masters', href: '/admin/masters', tone: 'warning' },
    {
      icon: 'shield-checkmark-outline',
      label: 'Roles',
      href: '/admin/roles',
      tone: 'danger',
      show: hasModule('employee'),
    },
    {
      icon: 'clipboard-outline',
      label: 'Compliance',
      href: '/admin/compliance',
      tone: 'info',
      show: hasModule('attendance'),
    },
  ].filter((a) => a.show !== false);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={[c.primary]} />
        }>
        <Hero
          name={displayName(me)}
          subtitle={[p.designation, p.department].filter(Boolean).join(' · ') || p.company_name || undefined}
        />

        <View style={styles.body}>
          {adminOnly ? (
            <>
              <Panel style={{ marginTop: -40 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.bigIcon, { backgroundColor: c.primarySoft }]}>
                    <Ionicons name="business-outline" size={24} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>Admin workspace</Text>
                    <Muted style={{ fontSize: 13 }}>Manage people, attendance, leave and payroll.</Muted>
                  </View>
                </View>
                <Button title="Open admin dashboard" onPress={() => router.push('/admin')} />
              </Panel>
              <CompanySwitcherRow />
              <SectionHeader title="Quick actions" />
              <Panel style={{ paddingHorizontal: 6 }}>
                <View style={styles.qaGrid}>
                  {adminActions.map((a) => (
                    <QuickAction key={a.href} {...a} onPress={() => router.push(a.href)} />
                  ))}
                </View>
              </Panel>
            </>
          ) : (
            <>
              {/* Today — overlaps the hero like the web welcome card */}
              <Panel style={{ marginTop: -40 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ gap: 2 }}>
                    <Muted style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Today
                    </Muted>
                    <Clock />
                  </View>
                  {today.isLoading ? null : (
                    <Pill
                      label={punchedIn ? 'Checked in' : t?.locked ? 'Locked' : 'Not checked in'}
                      tone={punchedIn ? 'primary' : t?.locked ? 'warning' : 'danger'}
                      icon={punchedIn ? 'radio-button-on' : 'ellipse-outline'}
                    />
                  )}
                </View>
                {today.isLoading ? (
                  <Loading />
                ) : todayError ? (
                  <ErrorText>{errorMessage(todayError, 'Could not load today’s status.')}</ErrorText>
                ) : (
                  <View style={[styles.todayRow, { backgroundColor: c.mutedBg }]}>
                    <View style={styles.todayCell}>
                      <Ionicons name="log-in-outline" size={18} color={c.primary} />
                      <Muted style={{ fontSize: 11.5 }}>Check in</Muted>
                      <Text style={[styles.todayVal, { color: c.text }]}>
                        {punchedIn ? fmtTime(t?.active_punch?.punch_in) : (t?.today_punches?.[0]?.in_time ?? '—')}
                      </Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: c.border }]} />
                    <View style={styles.todayCell}>
                      <Ionicons name="log-out-outline" size={18} color={c.danger} />
                      <Muted style={{ fontSize: 11.5 }}>Check out</Muted>
                      <Text style={[styles.todayVal, { color: c.text }]}>
                        {punchedIn ? '—' : (lastOut?.out_time ?? '—')}
                      </Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: c.border }]} />
                    <View style={styles.todayCell}>
                      <Ionicons name="briefcase-outline" size={18} color={c.goldText} />
                      <Muted style={{ fontSize: 11.5 }}>Shift</Muted>
                      <Text numberOfLines={1} style={[styles.todayVal, { color: c.text }]}>
                        {t?.shift ? `${fmtTime(t.shift.start)}` : '—'}
                      </Text>
                    </View>
                  </View>
                )}
                {t?.shift?.name ? (
                  <Muted style={{ fontSize: 12.5 }}>
                    {t.shift.name} · {fmtTime(t.shift.start)} – {fmtTime(t.shift.end)}
                  </Muted>
                ) : null}
                {t?.missed_punch_outs?.length ? (
                  <Pill
                    tone="warning"
                    icon="alert-circle-outline"
                    label={`${t.missed_punch_outs.length} missed punch-out${t.missed_punch_outs.length > 1 ? 's' : ''} — regularise`}
                  />
                ) : null}
                <Button
                  title={punchedIn ? 'Go to punch out' : 'Go to punch in'}
                  variant={punchedIn ? 'danger' : 'primary'}
                  onPress={() => router.navigate('/attendance')}
                />
              </Panel>

              <CompanySwitcherRow />

              {/* This month */}
              <SectionHeader title="This month" action="History" onAction={() => router.push('/attendance/history')} />
              {summary.isLoading ? (
                <Loading />
              ) : (
                <View style={styles.tiles}>
                  <StatTile icon="checkmark-circle-outline" label="Present" value={s?.present_days} tone="primary" />
                  <StatTile icon="close-circle-outline" label="Absent" value={s?.absent_days} tone="danger" />
                  <StatTile icon="airplane-outline" label="On leave" value={s?.leave_days} tone="violet" />
                  <StatTile icon="alarm-outline" label="Late marks" value={s?.late_marks} tone="orange" />
                  <StatTile icon="hourglass-outline" label="Avg hours" value={hours(s?.avg_work_hours)} tone="info" />
                  <StatTile icon="flash-outline" label="Overtime" value={hours(s?.overtime_hours)} tone="gold" />
                </View>
              )}

              {/* Quick actions */}
              {actions.length ? (
                <>
                  <SectionHeader title="Quick actions" />
                  <Panel style={{ paddingHorizontal: 6 }}>
                    <View style={styles.qaGrid}>
                      {actions.map((a) => (
                        <QuickAction key={a.href} {...a} onPress={() => router.push(a.href)} />
                      ))}
                    </View>
                  </Panel>
                </>
              ) : null}

              {/* Leave balance */}
              {hasModule('leave') && leaveLines.length ? (
                <>
                  <SectionHeader title="Leave balance" action="Apply" onAction={() => router.push('/leave/apply')} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {leaveLines.map((b, i) => (
                      <Panel key={`${b.name}-${i}`} style={{ width: 150, gap: 8 }}>
                        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12.5, fontWeight: '700' }}>
                          {b.name}
                        </Text>
                        <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>
                          {b.available ?? '—'}
                          <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>
                            {b.total != null ? ` / ${b.total}` : ''}
                          </Text>
                        </Text>
                        <Progress
                          value={b.total ? (b.available ?? 0) / b.total : 0}
                          tone={['primary', 'gold', 'info', 'violet', 'orange', 'warning'][i % 6]}
                        />
                        <Muted style={{ fontSize: 11.5 }}>{b.used != null ? `${b.used} used` : 'available'}</Muted>
                      </Panel>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {/* Upcoming holidays */}
              {upcoming.length ? (
                <>
                  <SectionHeader title="Upcoming holidays" action="See all" onAction={() => router.push('/holidays')} />
                  <Panel style={{ gap: 0, paddingVertical: 6 }}>
                    {upcoming.map((h, i) => {
                      const d = new Date(`${h.date}T00:00:00`);
                      return (
                        <View
                          key={h.id}
                          style={[
                            styles.holiday,
                            i < upcoming.length - 1 && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderColor: c.border,
                            },
                          ]}>
                          <View style={[styles.dateBox, { backgroundColor: c.goldSoft }]}>
                            <Text style={{ color: c.goldText, fontSize: 17, fontWeight: '800' }}>{d.getDate()}</Text>
                            <Text style={{ color: c.goldText, fontSize: 10.5, fontWeight: '700' }}>
                              {d.toLocaleDateString([], { month: 'short' }).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14.5 }}>{h.name}</Text>
                            <Muted style={{ fontSize: 12.5 }}>{d.toLocaleDateString([], { weekday: 'long' })}</Muted>
                          </View>
                        </View>
                      );
                    })}
                  </Panel>
                </>
              ) : null}

              {noProfile ? (
                <Muted style={{ textAlign: 'center' }}>Your employee profile is not linked yet — ask HR.</Muted>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, gap: 14 },
  panel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bigIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayRow: { flexDirection: 'row', borderRadius: 14, paddingVertical: 12 },
  todayCell: { flex: 1, alignItems: 'center', gap: 3 },
  todayVal: { fontSize: 14.5, fontWeight: '800' },
  divider: { width: 1, marginVertical: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  holiday: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dateBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
