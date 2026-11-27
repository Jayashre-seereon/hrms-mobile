import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { getEmployeeById } from '@/api/admin/employees';
import {
  cancelPromotion,
  employeeName,
  issuedAttachments,
  listPromotionDepartments,
  listPromotions,
  money,
  openPromotionAttachment,
  pickPromotionFiles,
  replyPromotionQuery,
  resendPromotionLetter,
  revisePromotion,
  uploadQueryReplyAttachments,
} from '@/api/movements';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const pretty = (s) => String(s ?? '').replace(/_/g, ' ');
const revisionFrom = (p = {}) => ({
  purpose: p.purpose ?? '',
  to_designation: p.to_designation ?? '',
  to_grade: p.to_grade || '',
  to_ctc: p.to_ctc != null ? String(p.to_ctc) : '',
  effective_from: p.effective_from ?? '',
  new_department: p.new_department || '',
  basis: p.basis ?? '',
  letter_body: p.letter_body || '',
});
/**
 * HR view of one promotion (web: PromotionsTab.jsx PromotionDetails): reply to the employee's query (with files),
 * edit and reissue, cancel, resend the letter, open attached files.
 * There is no GET-by-id endpoint, so the row comes from GET /cases/promotions (same cache as the register).
 */
export default function PromotionDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams();
  const { isAdmin, can } = useAccess();
  const canEdit = isAdmin || can('employee.edit');
  const list = useQuery({ queryKey: ['promotions', 'org'], queryFn: () => listPromotions() });
  const p = (list.data ?? []).find((r) => String(r.id) === String(id));
  const employee = useQuery({
    queryKey: ['employee', 'promotion-detail', p?.employee_id],
    queryFn: () => getEmployeeById(p.employee_id),
    enabled: !!p?.employee_id,
  });
  const emp = employee.data;
  const departments = useQuery({
    queryKey: ['departments', 'promotion', emp?.company_id],
    queryFn: () => listPromotionDepartments(emp.company_id),
    enabled: !!emp?.company_id,
  });
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(revisionFrom(p));
  const [cancelReason, setCancelReason] = useState('');
  useEffect(() => {
    if (p && !editing) setRevision(revisionFrom(p));
  }, [p, editing]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['promotions'] });
  const onError = (e) => Alert.alert('Promotion', errorMessage(e));
  const pid = String(p?.id ?? id);
  const replyMutation = useMutation({
    mutationFn: async () => {
      const attachments = replyFiles.length
        ? ((await uploadQueryReplyAttachments(pid, replyFiles)).attachments ?? [])
        : [];
      return replyPromotionQuery(pid, { reply: reply.trim(), resolve: true, attachments });
    },
    onSuccess: (data) => {
      Alert.alert(
        'Promotion',
        data?.email_status === 'SENT'
          ? 'Reply sent and employee email notification accepted.'
          : 'Reply saved, but employee email delivery needs attention.',
      );
      setReply('');
      setReplyFiles([]);
      refresh();
    },
    onError,
  });
  const reviseMutation = useMutation({
    mutationFn: () =>
      revisePromotion(pid, {
        ...revision,
        to_ctc: revision.to_ctc ? Number(revision.to_ctc) : null,
        new_department: revision.new_department || null,
      }),
    onSuccess: () => {
      Alert.alert('Promotion', 'Promotion revised and reissued.');
      setEditing(false);
      refresh();
    },
    onError,
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelPromotion(pid, cancelReason.trim()),
    onSuccess: () => {
      Alert.alert('Promotion', 'Promotion cancelled.');
      refresh();
      router.back();
    },
    onError,
  });
  const resendMutation = useMutation({
    mutationFn: () => resendPromotionLetter(pid),
    onSuccess: () => {
      Alert.alert('Promotion', 'Promotion letter emailed to the employee.');
      refresh();
    },
    onError,
  });
  const openFile = async (file) => {
    try {
      await openPromotionAttachment(pid, file);
    } catch (e) {
      Alert.alert('Attachment', errorMessage(e, 'Could not open the file.'));
    }
  };
  const fileLink = (file, i) => (
    <Pressable key={`${file.url ?? file.name}-${i}`} onPress={() => openFile(file)}>
      <Text style={{ color: c.primary }}>📎 {file.name}</Text>
    </Pressable>
  );
  if (list.isLoading)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Promotion" />
        <Loading />
      </View>
    );
  if (!p)
    return (
      <View style={{ flex: 1 }}>
        <Header title="Promotion" />
        <Page onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
          <ErrorText>
            {list.error ? errorMessage(list.error, 'Could not load promotions.') : 'Promotion not found.'}
          </ErrorText>
        </Page>
      </View>
    );
  const open = !['EFFECTIVE', 'CANCELLED'].includes(p.status);
  const accepted = ['ACCEPTED', 'ACKNOWLEDGED'].includes(p.employee_response);
  const issued = issuedAttachments(p);
  const queries = Array.isArray(p.query_history) ? p.query_history : [];
  const history = Array.isArray(p.history) ? p.history : [];
  const set = (k) => (v) => setRevision((r) => ({ ...r, [k]: v }));
  return (
    <View style={{ flex: 1 }}>
      <Header title={p.id} />
      <Page onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, flexShrink: 1 }}>
              {emp ? employeeName(emp) : 'Employee'}
              {emp?.employee_code ? ` · ${emp.employee_code}` : ''}
            </Text>
            <Badge label={p.status} />
          </View>
          <Row label="Purpose" value={p.purpose} />
          <Row label="Role" value={`${p.from_designation || '—'} → ${p.to_designation}`} />
          <Row label="Grade" value={`${p.from_grade || '—'} → ${p.to_grade || '—'}`} />
          <Row label="Annual CTC" value={`${money(p.from_ctc)} → ${money(p.to_ctc)}`} />
          <Row label="Effective date" value={p.effective_from ? fmtDate(p.effective_from) : ''} />
          {p.new_department ? <Row label="New department" value={p.new_department} /> : null}
          <Row label="Revision" value={String(p.revision || 1)} />
          <Row label="Employee response" value={pretty(p.employee_response || 'PENDING')} />
          <Row label="Email delivery" value={pretty(p.email_status || 'PENDING')} />
          {p.basis ? <Muted>Basis: {p.basis}</Muted> : null}
          {p.internal_remarks ? <Muted>Internal remarks: {p.internal_remarks}</Muted> : null}
          {p.letter_body ? <Muted>{p.letter_body}</Muted> : null}
        </Card>
        {issued.length ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Files sent with the promotion</Text>
            {issued.map(fileLink)}
          </Card>
        ) : null}
        {canEdit && (accepted || p.status === 'EFFECTIVE') ? (
          <Button
            title="Resend letter to employee"
            variant="outline"
            loading={resendMutation.isPending}
            onPress={() => resendMutation.mutate()}
          />
        ) : null}
        <Card style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Query conversation</Text>
          {queries.length === 0 ? <Muted>No queries from the employee.</Muted> : null}
          {queries.map((q, i) => (
            <View key={`${q.at}-${i}`} style={{ gap: 2 }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>
                {q.type === 'QUERY' ? 'Employee query' : 'HR reply'}
                <Text style={{ color: c.muted, fontWeight: '400' }}>
                  {q.at ? ` · ${new Date(q.at).toLocaleString()}` : ''}
                </Text>
              </Text>
              <Muted>{q.description || q.reply}</Muted>
              {Array.isArray(q.attachments) ? q.attachments.map(fileLink) : null}
            </View>
          ))}
          {canEdit && p.status === 'QUERY_RAISED' ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Field
                label="Reply"
                value={reply}
                onChangeText={setReply}
                multiline
                placeholder="Write a reply to the employee"
              />
              <Button
                title={replyFiles.length ? `${replyFiles.length} file(s) attached` : 'Attach files (PDF/images)'}
                variant="outline"
                onPress={async () => setReplyFiles(await pickPromotionFiles(replyFiles))}
              />
              <Button
                title="Send reply and resolve"
                loading={replyMutation.isPending}
                disabled={!reply.trim()}
                onPress={() => replyMutation.mutate()}
              />
            </View>
          ) : null}
        </Card>
        {canEdit && open ? (
          editing ? (
            <Card style={{ gap: 12 }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>Edit promotion details</Text>
              <Field label="Promotion type" value={revision.purpose} onChangeText={set('purpose')} />
              <Field label="New designation" value={revision.to_designation} onChangeText={set('to_designation')} />
              <Field label="New grade" value={revision.to_grade} onChangeText={set('to_grade')} />
              <Field
                label="Annual CTC"
                value={revision.to_ctc}
                onChangeText={set('to_ctc')}
                keyboardType="numeric"
              />
              <DateField label="Effective date" value={revision.effective_from} onChange={set('effective_from')} />
              <Select
                label="Department"
                value={revision.new_department}
                options={[
                  { value: '', label: 'Keep current department' },
                  ...(departments.data ?? []).map((d) => ({ value: d.department_name, label: d.department_name })),
                ]}
                onChange={set('new_department')}
              />
              <Field label="Basis" value={revision.basis} onChangeText={set('basis')} multiline />
              <Field label="Letter body" value={revision.letter_body} onChangeText={set('letter_body')} multiline />
              <Button
                title="Save and reissue"
                loading={reviseMutation.isPending}
                onPress={() => reviseMutation.mutate()}
              />
              <Button title="Close editor" variant="outline" onPress={() => setEditing(false)} />
            </Card>
          ) : (
            <Button title="Edit promotion" variant="outline" onPress={() => setEditing(true)} />
          )
        ) : null}
        {canEdit && open ? (
          <Card style={{ gap: 10 }}>
            <Field
              label="Reason for cancellation"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <Button
              title="Cancel promotion"
              variant="danger"
              loading={cancelMutation.isPending}
              disabled={!cancelReason.trim()}
              onPress={() =>
                Alert.alert('Cancel promotion', 'Cancel this promotion? The employee will be notified.', [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Cancel promotion', style: 'destructive', onPress: () => cancelMutation.mutate() },
                ])
              }
            />
          </Card>
        ) : null}
        {history.length ? (
          <Card style={{ gap: 4 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Promotion history</Text>
            {history.map((h, i) => (
              <Muted key={i} style={{ fontSize: 12 }}>
                {[String(h.at ?? '').slice(0, 16).replace('T', ' '), h.action, h.note].filter(Boolean).join(' · ')}
              </Muted>
            ))}
          </Card>
        ) : null}
      </Page>
    </View>
  );
}
