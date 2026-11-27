import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { deleteDraft, getMyTimesheetSummary, submitDraft } from '@/api/timesheets';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Loading, Muted } from '@/ui/components';
import { fmtDate, fmtTime } from '@/ui/format';
import { Badge, Fab, Header, ItemCard, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'muted'> = {
  Approved: 'success',
  Rejected: 'danger',
  Submitted: 'warning',
  Draft: 'muted',
};

function Kpi({ label, value }: { label: string; value?: number | string }) {
  const c = useColors();
  return (
    <View style={{ width: '33%', alignItems: 'center', gap: 2, paddingVertical: 6 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>{value ?? 0}</Text>
      <Muted style={{ fontSize: 12, textAlign: 'center' }}>{label}</Muted>
    </View>
  );
}

/** My timesheets (web: MyTimesheetsView → GET /timesheets/me: kpis + grouped_history). */
export default function TimesheetsScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['timesheets', 'me'], queryFn: () => getMyTimesheetSummary() });

  const refresh = () => qc.invalidateQueries({ queryKey: ['timesheets'] });
  const submit = useMutation({
    mutationFn: (id: string | number) => submitDraft(id),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Timesheets', errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string | number) => deleteDraft(id),
    onSuccess: refresh,
    onError: (err) => Alert.alert('Timesheets', errorMessage(err)),
  });

  const kpis = query.data?.kpis ?? {};
  const groups = (query.data?.grouped_history ?? []) as Record<string, any>[];

  return (
    <View style={{ flex: 1 }}>
      <Header title="Timesheets" />
      <Page onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorText>{errorMessage(query.error, 'Could not load your timesheets.')}</ErrorText>
        ) : (
          <>
            <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
              <Kpi label="Total hours" value={kpis.total_hours} />
              <Kpi label="Entries" value={kpis.entries_logged} />
              <Kpi label="Awaiting approval" value={kpis.awaiting_approval} />
              <Kpi label="Overtime" value={kpis.overtime_hours} />
              <Kpi label="Short hours" value={kpis.short_hours} />
            </Card>
            {groups.length === 0 ? <Muted>No timesheet entries yet. Tap + to log your work.</Muted> : null}
            {groups.map((g) => (
              <View key={g.date} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{fmtDate(g.date)}</Text>
                  <Muted>
                    {g.day_hours ?? 0} h{g.verdict ? ` · ${g.verdict}` : ''}
                  </Muted>
                </View>
                {((g.entries ?? []) as Record<string, any>[]).map((e) => (
                  <ItemCard
                    key={String(e.id)}
                    title={e.task || 'Task'}
                    badge={<Badge label={e.status} tone={TONE[e.status]} />}
                    lines={[
                      [e.project, `${e.hours ?? 0} h`, e.start_time && e.end_time ? `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}` : null]
                        .filter(Boolean)
                        .join(' · '),
                      e.task_status ? `Task: ${e.task_status}` : null,
                      e.description,
                      e.remarks ? `Remarks: ${e.remarks}` : null,
                    ]}>
                    {e.status === 'Draft' || e.status === 'Rejected' ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            title={e.status === 'Rejected' ? 'Correct' : 'Edit'}
                            variant="outline"
                            onPress={() =>
                              router.push({
                                pathname: '/timesheets/new',
                                params: { entry: JSON.stringify({ ...e, date: e.date ?? g.date }) },
                              })
                            }
                          />
                        </View>
                        {e.status === 'Draft' ? (
                          <>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Submit"
                                loading={submit.isPending && submit.variables === e.id}
                                onPress={() => submit.mutate(e.id)}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button
                                title="Delete"
                                variant="danger"
                                loading={remove.isPending && remove.variables === e.id}
                                onPress={() =>
                                  Alert.alert('Delete draft', 'Delete this draft entry?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(e.id) },
                                  ])
                                }
                              />
                            </View>
                          </>
                        ) : null}
                      </View>
                    ) : null}
                  </ItemCard>
                ))}
              </View>
            ))}
          </>
        )}
      </Page>
      <Fab onPress={() => router.push('/timesheets/new')} />
    </View>
  );
}
