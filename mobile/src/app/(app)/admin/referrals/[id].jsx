import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  getAdminReferralDetail,
  payReferralBonus,
  REFERRAL_STATUS_UPDATES,
  retentionOf,
  updateReferralStatus,
} from '@/api/referrals';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const inr = (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;
/**
 * One referral (web: ReferralsTab.jsx "View" dialog): GET /referrals/{id}, PATCH /referrals/{id}/status,
 * POST /referrals/{id}/pay-bonus (Hired + 90-day retention, enforced by the server too).
 */
export default function AdminReferralDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit') || can('recruitment.edit');
  const q = useQuery({
    queryKey: ['admin', 'referral', id],
    queryFn: () => getAdminReferralDetail(String(id)),
    enabled: !!id,
  });
  const r = q.data ?? {};
  const rid = String(r.id ?? id);
  const [remarks, setRemarks] = useState('Disbursed with current payroll batch.');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'referral'] });
    qc.invalidateQueries({ queryKey: ['admin', 'referrals'] });
  };
  const onError = (err) => Alert.alert('Referral', errorMessage(err));
  const setStatus = useMutation({
    mutationFn: (status) => updateReferralStatus(rid, status),
    onSuccess: (_d, status) => {
      refresh();
      Alert.alert('Referral', `Status updated to ${status}; candidate and referrer notified.`);
    },
    onError,
  });
  const pay = useMutation({
    mutationFn: () => payReferralBonus(rid, remarks),
    onSuccess: () => {
      refresh();
      Alert.alert('Referral', `${inr(r.bonus_amount ?? r.bonusAmount)} referral bonus queued for payroll.`);
    },
    onError,
  });
  if (q.isLoading)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Referral" />
        <Loading />
      </View>
    );
  const eligible = r.bonus_eligible !== false && r.bonusEligible !== false;
  const retention = retentionOf(r);
  const statusOptions = [
    ...(REFERRAL_STATUS_UPDATES.includes(r.status) || !r.status ? [] : [{ label: r.status, value: r.status }]),
    ...REFERRAL_STATUS_UPDATES.map((s) => ({ label: s, value: s })),
  ];
  const history = Array.isArray(r.history) ? r.history : [];
  return (
    <View style={{ flex: 1 }}>
      <Header title={r.code || 'Referral'} />
      <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
        {q.error ? <ErrorText>{errorMessage(q.error, 'Could not load the referral.')}</ErrorText> : null}
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 17, flexShrink: 1 }}>
              {r.candidate_name || r.candidateName || 'Candidate'}
            </Text>
            <Badge label={r.status} />
          </View>
          <Row label="Email" value={r.email} />
          <Row label="Phone" value={r.phone} />
          <Row label="Job post" value={[r.job_title, r.job_id].filter(Boolean).join(' · ')} />
          <Row label="Relationship" value={r.relationship} />
          <Row label="Experience" value={`${Number(r.experience_years ?? 0)} years`} />
          <Row label="Skills" value={r.skills} />
          <Row label="CV" value={r.cv_file_name} />
          <Row label="Note" value={r.note} />
          <Row label="Referred on" value={r.created_on ? fmtDate(r.created_on) : ''} />
          <Row label="Applicant" value={r.applicant_id ? `${r.applicant_id} · ${r.ats_stage ?? 'Applied'}` : ''} />
          {r.interview_date ? <Row label="Interview" value={fmtDate(r.interview_date)} /> : null}
          <Row
            label="Bonus"
            value={
              eligible
                ? `${inr(r.bonus_amount)}${r.bonus_paid_on ? ` · paid ${fmtDate(r.bonus_paid_on)}` : ''}`
                : 'Not eligible'
            }
          />
        </Card>
        {canEdit && r.status && r.status !== 'Bonus paid' ? (
          <Card style={{ gap: 12 }}>
            <Select
              label="Update status"
              value={r.status}
              options={statusOptions}
              onChange={(v) => {
                if (v !== r.status) setStatus.mutate(v);
              }}
            />
            {setStatus.isPending ? <Muted>Updating…</Muted> : null}
          </Card>
        ) : null}
        {canEdit && r.status === 'Hired' && eligible ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Referral bonus</Text>
            {retention.eligible ? (
              <>
                <Field label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
                <Button
                  title={`Pay ${inr(r.bonus_amount)} with payroll`}
                  loading={pay.isPending}
                  onPress={() =>
                    Alert.alert('Pay bonus', `Queue ${inr(r.bonus_amount)} referral bonus for payroll?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Pay', onPress: () => pay.mutate() },
                    ])
                  }
                />
              </>
            ) : (
              <Muted>Candidate must complete 90 days retention. {retention.remaining} day(s) remaining.</Muted>
            )}
          </Card>
        ) : null}
        {history.length ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>History</Text>
            {history.map((h, i) => (
              <View key={String(h.id ?? i)} style={{ gap: 2 }}>
                <Text style={{ color: c.text }}>{h.action}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {[h.action_by, h.action_at ? fmtDate(h.action_at) : null].filter(Boolean).join(' · ')}
                </Muted>
              </View>
            ))}
          </Card>
        ) : null}
      </Page>
    </View>
  );
}
