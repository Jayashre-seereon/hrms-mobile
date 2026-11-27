import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { reviewTimesheetEntry } from '@/api/timesheets';
import { errorMessage } from '@/lib/api';
import { Button, Card, Field, Muted, Row } from '@/ui/components';
import { fmtDate } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
/**
 * Timesheet review (web: features/timesheets/views/TimesheetsView.jsx → timesheetApi.reviewDecision):
 * POST /timesheets/entries/{id}/decision { action: 'APPROVE' | 'REJECT', remarks }.
 * The backend has no "team entries" list endpoint (the web lists entries from its local store), so the entry is
 * opened by id — from a route param (`/timesheets/approvals?id=<uuid>`, e.g. a notification) or typed in.
 * Allowed for the employee's manager, or HR / admin roles; nobody can review their own entries.
 */
export default function TimesheetApprovalsScreen() {
  const params = useLocalSearchParams();
  const [entryId, setEntryId] = useState(params.id ? String(params.id) : '');
  const [remarks, setRemarks] = useState('');
  const [result, setResult] = useState(null);
  const decide = useMutation({
    mutationFn: ({ action }) => reviewTimesheetEntry(entryId.trim(), { action, remarks: remarks.trim() }),
    onSuccess: (entry, { action }) => {
      setResult(entry);
      setRemarks('');
      Alert.alert('Timesheets', action === 'APPROVE' ? 'Entry approved.' : 'Entry rejected.');
    },
    onError: (err) => Alert.alert('Timesheets', errorMessage(err)),
  });
  const run = (action) => {
    if (!entryId.trim()) return Alert.alert('Timesheets', 'Enter the timesheet entry id.');
    if (action === 'REJECT' && !remarks.trim())
      return Alert.alert('Timesheets', 'Remarks are required when rejecting a timesheet entry.');
    decide.mutate({ action });
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="Timesheet approvals" />
      <Page>
        <Muted>Approve or reject a submitted timesheet entry of your team. Rejecting needs remarks.</Muted>
        <Card style={{ gap: 12 }}>
          <Field
            label="Entry id"
            value={entryId}
            onChangeText={setEntryId}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Timesheet entry id"
          />
          <Field
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            placeholder="Optional to approve, required to reject"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Approve"
                loading={decide.isPending && decide.variables?.action === 'APPROVE'}
                disabled={decide.isPending}
                onPress={() => run('APPROVE')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Reject"
                variant="danger"
                loading={decide.isPending && decide.variables?.action === 'REJECT'}
                disabled={decide.isPending}
                onPress={() => run('REJECT')}
              />
            </View>
          </View>
        </Card>
        {result ? (
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Muted>Last decision</Muted>
              <Badge label={result.status} />
            </View>
            <Row label="Employee" value={result.employee_name ?? result.employee ?? '—'} />
            <Row label="Date" value={result.date ? fmtDate(result.date) : '—'} />
            <Row label="Task" value={result.task ?? '—'} />
            <Row label="Hours" value={result.hours != null ? `${result.hours} h` : '—'} />
            {result.remarks ? <Row label="Remarks" value={result.remarks} /> : null}
          </Card>
        ) : null}
      </Page>
    </View>
  );
}
