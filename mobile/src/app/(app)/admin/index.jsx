import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { attendanceToday, grievanceStats, headcount, payrollSummary } from '@/api/admin/dashboard';
import { useMenuGroups } from '@/features/nav/menu';
import { useAccess } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { displayName, useSession } from '@/store/session';
import { Button, Muted } from '@/ui/components';
import { Hero, Pill, Progress, QuickAction, SectionHeader, StatTile } from '@/ui/dashboard';
import { toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const money = (v) => (v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`);
const TONES = ['primary', 'info', 'orange', 'violet', 'gold', 'warning', 'danger'];
const ADMIN_GROUPS = ['admin', 'people', 'time-admin', 'payroll-admin', 'org'];
const statusTone = (s = '') =>
  /paid|approved|processed/i.test(s)
    ? 'primary'
    : /reject|fail/i.test(s)
      ? 'danger'
      : /pending/i.test(s)
        ? 'warning'
        : 'info';

function Panel({ children, style }) {
  const c = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border, shadowColor: c.primaryDark }, style]}>
      {children}
    </View>
  );
}

export default function AdminDashboard() {
  const c = useColors();
  const router = useRouter();
  const { hasModule, role, isOrgMode } = useAccess();
  const me = useSession((s) => s.me);
  const companyName = useSession((s) => s.scopeCompanyName);
  const groups = useMenuGroups().filter((g) => ADMIN_GROUPS.includes(g.key));
  const today = toISODate(new Date());
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('auto');
    }, []),
  );
  // Each card loads on its own and only when its module is on for the company (web: permitted_modules) — no 403s.
  const showEmployees = hasModule('employee');
  const showAttendance = hasModule('attendance');
  const showPayroll = hasModule('payroll');
  const showGrievances = hasModule('helpdesk');
  const heads = useQuery({ queryKey: ['admin', 'dash', 'headcount'], queryFn: headcount, enabled: showEmployees });
  const att = useQuery({
    queryKey: ['admin', 'dash', 'attendance', today],
    queryFn: () => attendanceToday(today),
    enabled: showAttendance,
  });
  const pay = useQuery({ queryKey: ['admin', 'dash', 'payroll'], queryFn: payrollSummary, enabled: showPayroll });
  const griev = useQuery({
    queryKey: ['admin', 'dash', 'grievances'],
    queryFn: grievanceStats,
    enabled: showGrievances,
  });
  const refreshing = heads.isRefetching || att.isRefetching || pay.isRefetching || griev.isRefetching;
  const onRefresh = () => {
    if (showEmployees) heads.refetch();
    if (showAttendance) att.refetch();
    if (showPayroll) pay.refetch();
    if (showGrievances) griev.refetch();
  };
  const a = att.data;
  const latest = pay.data?.latest;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false, title: 'Admin dashboard' }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={[c.primary]} />
        }>
        <Hero
          name={displayName(me)}
          subtitle={['Admin dashboard', companyName || role.replace(/_/g, ' ').toLowerCase()]
            .filter(Boolean)
            .join(' · ')}
          right={
            router.canGoBack() ? (
              <Ionicons
                name="close"
                size={24}
                color="#FFFFFFCC"
                onPress={() => router.back()}
                style={{ width: 40, textAlign: 'right' }}
              />
            ) : undefined
          }
        />

        <View style={styles.body}>
          {/* Today at a glance — overlaps the hero */}
          <Panel style={{ marginTop: -40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>
                {isOrgMode ? 'Organisation' : 'Today at a glance'}
              </Text>
              {a?.percent != null ? <Pill label={`${a.percent}% present`} tone="primary" icon="trending-up" /> : null}
            </View>
            {isOrgMode ? (
              <>
                <Muted>
                  You are at organisation level. Pick a company to see its attendance, people and payroll — or open the
                  organisation dashboard.
                </Muted>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Pick a company" onPress={() => router.push('/company-picker')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Org dashboard"
                      variant="outline"
                      onPress={() => router.push('/admin/org-dashboard')}
                    />
                  </View>
                </View>
              </>
            ) : showAttendance ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ color: c.text, fontSize: 34, fontWeight: '800' }}>{a?.present ?? '—'}</Text>
                  <Muted style={{ marginBottom: 7 }}>{a?.total ? `of ${a.total} employees present` : 'present'}</Muted>
                </View>
                <Progress value={a?.total ? (a.present ?? 0) / a.total : 0} />
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Legend color={c.danger} label="Absent" value={a?.absent} />
                  <Legend color={c.violet} label="On leave" value={a?.onLeave} />
                </View>
              </>
            ) : (
              <Muted>Attendance module is not enabled for this company.</Muted>
            )}
          </Panel>

          {isOrgMode ? null : (
            <CompanyScopeNotice message="Pick a company to see its figures — without one the cards below may be empty." />
          )}

          {/* KPIs */}
          <View style={styles.tiles}>
            {showEmployees ? (
              <StatTile
                icon="people-outline"
                label="Employees"
                value={heads.data}
                tone="primary"
                onPress={() => router.push('/admin/employees')}
              />
            ) : null}
            {showAttendance ? (
              <StatTile
                icon="close-circle-outline"
                label="Absent today"
                value={a?.absent}
                tone="danger"
                onPress={() => router.push('/admin/attendance')}
              />
            ) : null}
            {showAttendance ? (
              <StatTile
                icon="airplane-outline"
                label="On leave"
                value={a?.onLeave}
                tone="violet"
                onPress={() => router.push('/admin/attendance')}
              />
            ) : null}
            {showGrievances ? (
              <StatTile
                icon="chatbubbles-outline"
                label="Open grievances"
                value={griev.data?.totalOpen}
                hint={griev.data?.slaBreached ? `${griev.data.slaBreached} SLA breached` : undefined}
                tone="orange"
                onPress={() => router.push('/admin/grievances')}
              />
            ) : null}
            {showGrievances ? (
              <StatTile
                icon="timer-outline"
                label="Avg days to resolve"
                value={griev.data?.avgDaysToResolve}
                tone="info"
              />
            ) : null}
            {showPayroll ? (
              <StatTile
                icon="hourglass-outline"
                label="Awaiting approval"
                value={pay.data?.awaiting ?? (pay.isLoading ? null : 0)}
                tone="gold"
                onPress={() => router.push('/admin/payroll-runs')}
              />
            ) : null}
          </View>

          {/* Payroll */}
          {showPayroll ? (
            <>
              <SectionHeader title="Payroll" action="All runs" onAction={() => router.push('/admin/payroll-runs')} />
              <Panel>
                {latest ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.bigIcon, { backgroundColor: c.goldSoft }]}>
                      <Ionicons name="wallet-outline" size={24} color={c.goldText} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Muted style={{ fontSize: 12.5 }}>Latest run · {latest.period}</Muted>
                      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{money(latest.net)}</Text>
                      <Muted style={{ fontSize: 12 }}>Net pay</Muted>
                    </View>
                    <Pill label={latest.status} tone={statusTone(latest.status)} />
                  </View>
                ) : (
                  <Muted>{pay.isLoading ? 'Loading…' : 'No payroll runs yet.'}</Muted>
                )}
              </Panel>
            </>
          ) : null}

          {/* Every admin screen, grouped like the web sidebar */}
          {groups.map((g) => (
            <View key={g.key} style={{ gap: 10 }}>
              <SectionHeader title={g.label} />
              <Panel style={{ paddingHorizontal: 6 }}>
                <View style={styles.qaGrid}>
                  {g.items.map((i, idx) => (
                    <QuickAction
                      key={i.href}
                      icon={i.icon}
                      label={i.label}
                      tone={TONES[idx % TONES.length]}
                      onPress={() => router.push(i.href)}
                    />
                  ))}
                </View>
              </Panel>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Legend({ color, label, value }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Muted style={{ fontSize: 13 }}>{label}</Muted>
      <Text style={{ color: c.text, fontWeight: '800' }}>{value ?? '—'}</Text>
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
