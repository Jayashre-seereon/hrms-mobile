import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  acknowledgeGrievance,
  addGrievanceNote,
  closeGrievance,
  getGrievance,
  resolveGrievance,
} from '@/api/admin/grievances';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Button, Card, ErrorText, Field, Loading, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

/** HR handling of one grievance (web: GrievancePieces.jsx, mode "hr"). */
export default function GrievanceDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, isAdmin } = useAccess();
  const canAct = isAdmin || can('exit.edit') || can('grievance.edit') || can('grievances.edit');

  const q = useQuery({ queryKey: ['admin', 'grievance', id], queryFn: () => getGrievance(String(id)), enabled: !!id });
  const g: Record<string, any> = q.data ?? {};
  const gid = String(g.id ?? g.code ?? id);

  const [owner, setOwner] = useState('');
  const [committee, setCommittee] = useState('');
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(true);
  const [resolution, setResolution] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: ['admin', 'grievance'] });
    qc.invalidateQueries({ queryKey: ['admin', 'grievances'] });
    Alert.alert('Grievance', msg);
  };
  const onError = (err: unknown) => Alert.alert('Grievance', errorMessage(err));

  const ack = useMutation({ mutationFn: () => acknowledgeGrievance(gid, { ownerName: owner, committee }), onSuccess: done('Acknowledged.'), onError });
  const addNote = useMutation({
    mutationFn: () => addGrievanceNote(gid, note, visible),
    onSuccess: () => {
      setNote('');
      done('Note added.')();
    },
    onError,
  });
  const resolve = useMutation({ mutationFn: () => resolveGrievance(gid, resolution, actionTaken), onSuccess: done('Marked resolved. The 7-day confirmation window has started.'), onError });
  const close = useMutation({ mutationFn: () => closeGrievance(gid), onSuccess: done('Closed.'), onError });

  const status = String(g.status ?? '');
  const notes: any[] = Array.isArray(g.investigation) ? g.investigation : [];
  const open = !['Closed', 'Withdrawn'].includes(status);

  return (
    <Page onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title={g.code ? String(g.code) : 'Grievance'} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorText>{errorMessage(q.error, 'Could not load the grievance.')}</ErrorText>
      ) : (
        <>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', flexShrink: 1 }}>{g.subject || g.category}</Text>
              <Badge label={status} />
            </View>
            {g.description ? <Text style={{ color: c.text }}>{g.description}</Text> : null}
          </Card>

          <Card style={{ gap: 0 }}>
            <Row label="Category" value={g.category} />
            <Row label="Severity" value={g.severity} />
            <Row label="Raised by" value={g.anonymous ? 'Anonymous' : g.employee || g.display_name} />
            <Row label="Department" value={g.dept || g.department} />
            <Row label="Against" value={g.against} />
            <Row label="Owner" value={g.owner || g.owner_name} />
            <Row label="Committee" value={Array.isArray(g.committee) ? g.committee.join(', ') : g.committee} />
            <Row label="Raised on" value={fmtDate(g.raisedOn ?? g.raised_on)} />
            <Row label="Acknowledge by" value={g.ackDue ? fmtDate(g.ackDue) : null} />
            <Row label="Resolve by" value={g.resolveDue ? fmtDate(g.resolveDue) : null} />
            {g.resolution ? <Row label="Resolution" value={g.resolution} /> : null}
            {g.appealReason ? <Row label="Appeal" value={g.appealReason} /> : null}
            {g.employeeRating ?? g.employee_rating ? <Row label="Employee rating" value={String(g.employeeRating ?? g.employee_rating)} /> : null}
          </Card>

          {notes.length ? (
            <Card>
              <Text style={{ color: c.text, fontWeight: '600' }}>Investigation log</Text>
              {notes.map((n, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <Text style={{ color: c.text }}>{n.note}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {[n.by, n.at ? fmtDate(n.at) : null, n.visibleToEmployee === false ? 'Internal' : null].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
              ))}
            </Card>
          ) : null}

          {canAct && open ? (
            <>
              {status === 'Submitted' ? (
                <Card style={{ gap: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>Acknowledge</Text>
                  <Field label="Reassign owner (optional)" value={owner} onChangeText={setOwner} />
                  <Field label="Committee (optional)" value={committee} onChangeText={setCommittee} />
                  <Button title="Acknowledge & notify complainant" onPress={() => ack.mutate()} loading={ack.isPending} />
                </Card>
              ) : null}

              {['Acknowledged', 'Under investigation', 'Appealed'].includes(status) ? (
                <>
                  <Card style={{ gap: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '600' }}>Add investigation note</Text>
                    <Field label="Note" value={note} onChangeText={setNote} multiline style={{ minHeight: 80 }} />
                    <Pressable onPress={() => setVisible((v) => !v)}>
                      <Text style={{ color: c.text }}>{visible ? '☑' : '☐'} Visible to employee</Text>
                    </Pressable>
                    <Button title="Add note" onPress={() => addNote.mutate()} loading={addNote.isPending} disabled={!note.trim()} />
                  </Card>
                  <Card style={{ gap: 12 }}>
                    <Text style={{ color: c.text, fontWeight: '600' }}>Resolve</Text>
                    <Field label="Resolution" value={resolution} onChangeText={setResolution} multiline />
                    <Field label="Action taken (optional)" value={actionTaken} onChangeText={setActionTaken} multiline />
                    <Button title="Mark resolved" onPress={() => resolve.mutate()} loading={resolve.isPending} disabled={!resolution.trim()} />
                  </Card>
                </>
              ) : null}

              {status === 'Resolved' ? (
                <Card style={{ gap: 8 }}>
                  <Muted>Waiting for the employee to confirm. HR can close after the 7-day window.</Muted>
                  <Button
                    title="Close grievance"
                    variant="outline"
                    loading={close.isPending}
                    onPress={() =>
                      Alert.alert('Close grievance', 'Close this grievance now?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Close', onPress: () => close.mutate() },
                      ])
                    }
                  />
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}
