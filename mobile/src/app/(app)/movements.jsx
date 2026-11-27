import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { resolveApiUrl } from '@/api/documents';
import { acknowledgeMyPromotion, getMyMovements, queryMyPromotion, uploadQueryAttachments } from '@/api/movements';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, ItemCard, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const money = (v) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? '—' : `₹${n.toLocaleString('en-IN')}`;
};
const accepted = (p) => ['ACCEPTED', 'ACKNOWLEDGED'].includes(p.employee_response);
const terminal = (p) => ['EFFECTIVE', 'CANCELLED'].includes(p.status);
function PromotionCard({ p, onChanged }) {
  const c = useColors();
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const queryPending = p.status === 'QUERY_RAISED';
  const isAccepted = accepted(p);
  const ack = useMutation({
    mutationFn: () => acknowledgeMyPromotion(String(p.id)),
    onSuccess: (data) => {
      Alert.alert(
        'Promotion',
        data?.email_status === 'LETTER_SENT'
          ? 'Promotion accepted and letter emailed to you.'
          : 'Promotion accepted; the letter email needs attention.',
      );
      onChanged();
    },
    onError: (e) => Alert.alert('Promotion', errorMessage(e)),
  });
  const ask = useMutation({
    mutationFn: async () => {
      const attachments = files.length ? ((await uploadQueryAttachments(String(p.id), files)).attachments ?? []) : [];
      return queryMyPromotion(String(p.id), { description: draft.trim(), attachments });
    },
    onSuccess: (data) => {
      Alert.alert(
        'Promotion',
        data?.email_status === 'SENT' ? 'Query sent to HR.' : 'Query saved, but the email notification failed.',
      );
      setAsking(false);
      setDraft('');
      setFiles([]);
      onChanged();
    },
    onError: (e) => setError(errorMessage(e, 'Could not send the query.')),
  });
  const pickFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/png', 'image/jpeg'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const picked = res.assets
      .filter((a) => !a.size || a.size <= 5 * 1024 * 1024)
      .slice(0, 5)
      .map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' }));
    if (picked.length < res.assets.length)
      Alert.alert('Attachments', 'Up to 5 files, 5 MB each. Some files were skipped.');
    setFiles(picked);
  };
  const letterUrl = resolveApiUrl(p.letter_file_url);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
            {p.from_designation || 'Current designation'} → {p.to_designation}
          </Text>
          <Muted>
            {[p.purpose, p.effective_from && `Effective ${fmtDate(p.effective_from)}`].filter(Boolean).join(' · ')}
          </Muted>
        </View>
        <Badge label={queryPending ? 'QUERY_RAISED' : p.status || 'Pending'} />
      </View>
      <View>
        <Row label="New pay grade" value={p.to_grade || 'No change'} />
        <Row label="New annual CTC" value={money(p.to_ctc)} />
        <Row
          label="Your response"
          value={isAccepted ? 'Accepted' : queryPending ? 'Query sent to HR' : 'Please respond'}
        />
      </View>
      {p.basis ? <Muted>Reason: {p.basis}</Muted> : null}
      {p.letter_body ? <Muted>{p.letter_body}</Muted> : null}
      {letterUrl ? (
        <Pressable onPress={() => Linking.openURL(letterUrl)}>
          <Text style={{ color: c.primary }}>Open attached letter</Text>
        </Pressable>
      ) : null}
      {Array.isArray(p.query_history) && p.query_history.length ? (
        <View style={{ gap: 6 }}>
          {p.query_history.map((q, i) => (
            <Muted key={i}>
              {q.type === 'QUERY' ? 'Your query' : 'HR response'}
              {q.at ? ` · ${new Date(q.at).toLocaleString()}` : ''}: {q.description || q.reply}
            </Muted>
          ))}
        </View>
      ) : null}
      <Muted>
        {queryPending
          ? 'Your query is with HR. The reply will show here.'
          : isAccepted
            ? p.status === 'EFFECTIVE'
              ? 'Promotion is effective. Your profile and salary records have been updated.'
              : `Accepted. Profile and payroll update on ${p.effective_from ?? 'the effective date'}.`
            : terminal(p)
              ? p.status === 'CANCELLED'
                ? 'This promotion was cancelled. Contact HR if you need more information.'
                : ''
              : 'Choose Accept promotion or Raise a query.'}
      </Muted>

      {!isAccepted && !queryPending && !terminal(p) ? (
        asking ? (
          <View style={{ gap: 10 }}>
            <Field label="What would you like HR to review?" value={draft} onChangeText={setDraft} multiline />
            <Button
              title={files.length ? `${files.length} file(s) attached` : 'Attach files (PDF/images)'}
              variant="outline"
              onPress={pickFiles}
            />
            <ErrorText>{error}</ErrorText>
            <Button
              title="Submit query to HR"
              onPress={() => ask.mutate()}
              loading={ask.isPending}
              disabled={!draft.trim()}
            />
            <Button title="Cancel" variant="outline" onPress={() => setAsking(false)} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Button title="Accept promotion" onPress={() => ack.mutate()} loading={ack.isPending} />
            <Button
              title="Raise a query"
              variant="outline"
              onPress={() => {
                setError('');
                setAsking(true);
              }}
            />
          </View>
        )
      ) : null}
    </Card>
  );
}
/** Other movement lists returned by /emp/movements (transfers, warnings, …) shown generically. */
function OtherMovements({ data }) {
  const c = useColors();
  const lists = Object.entries(data).filter(([k, v]) => k !== 'promotions' && Array.isArray(v) && v.length);
  if (!lists.length) return null;
  return (
    <>
      {lists.map(([key, rows]) => (
        <View key={key} style={{ gap: 10 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', textTransform: 'capitalize' }}>
            {key.replace(/_/g, ' ')}
          </Text>
          {rows.map((r, i) => (
            <ItemCard
              key={String(r.id ?? i)}
              title={r.title || r.type || r.reason || r.subject || r.to_branch || r.to_department || key}
              badge={<Badge label={r.status} />}
              lines={[
                r.from_branch || r.to_branch ? `${r.from_branch ?? '—'} → ${r.to_branch ?? '—'}` : null,
                r.description || r.remarks || r.note,
                (r.effective_from || r.date || r.created_at) && fmtDate(r.effective_from || r.date || r.created_at),
              ]}
            />
          ))}
        </View>
      ))}
    </>
  );
}
export default function MovementsScreen() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['movements', 'mine'], queryFn: getMyMovements });
  const promotions = query.data?.promotions ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['movements'] });
  return (
    <Page onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Header title="My movements" />
      <Muted>Review your promotion, respond to HR, and follow transfers and other movement records.</Muted>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorText>{errorMessage(query.error, 'Could not load promotions.')}</ErrorText>
      ) : (
        <>
          {promotions.length === 0 ? <Muted>No promotions have been issued to you.</Muted> : null}
          {promotions.map((p) => (
            <PromotionCard key={String(p.id)} p={p} onChanged={refresh} />
          ))}
          <OtherMovements data={query.data ?? {}} />
        </>
      )}
    </Page>
  );
}
