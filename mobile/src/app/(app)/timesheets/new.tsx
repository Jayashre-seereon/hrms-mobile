import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import {
  batchFillTimesheet,
  correctAndResubmit,
  getTimesheetFormats,
  getTimesheetMeta,
  TimesheetTask,
} from '@/api/timesheets';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { DateField, Header, Page, Select, toISODate } from '@/ui/kit';
import { useColors } from '@/ui/theme';

// Fallbacks when /timesheets/meta has no lists (same idea as the web's PROJECTS / TASK_STATUSES).
const DEFAULT_TASK_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Blocked'];
const DEFAULT_PROJECTS = ['Internal — General'];

type Row = { project: string; task: string; description: string; start: string; end: string; hours: string; taskStatus: string; billable: boolean };

const hoursBetween = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
};

const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '');

/**
 * Log work for one day (web: batch fill → POST /timesheets/me/entries with status "Submitted" or "Draft"),
 * or correct a Draft / Rejected entry (PUT /timesheets/me/entries/{id}) when opened with ?entry=<json>.
 */
export default function NewTimesheetScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { entry: entryParam } = useLocalSearchParams<{ entry?: string }>();
  const entry = useMemo<Record<string, any> | null>(() => {
    try {
      return entryParam ? JSON.parse(entryParam) : null;
    } catch {
      return null;
    }
  }, [entryParam]);

  const meta = useQuery({ queryKey: ['timesheets', 'meta'], queryFn: getTimesheetMeta });
  const formats = useQuery({ queryKey: ['timesheets', 'formats'], queryFn: getTimesheetFormats });

  const projects: string[] = meta.data?.projects?.length ? meta.data.projects : DEFAULT_PROJECTS;
  const taskStatuses: string[] = meta.data?.task_statuses?.length ? meta.data.task_statuses : DEFAULT_TASK_STATUSES;

  const [formatName, setFormatName] = useState('');
  const format = (formats.data ?? []).find((f) => f.name === formatName) ?? (formats.data ?? [])[0];
  const shows = (f: string) => !format || (Array.isArray(format.fields) && format.fields.includes(f));
  const timed = entry ? Boolean(entry.start_time && entry.end_time) || (shows('Start Time') && shows('End Time')) : shows('Start Time') && shows('End Time');

  const [date, setDate] = useState<string>(entry?.date ?? toISODate(new Date()));
  const newRow = (): Row => ({
    project: entry?.project ?? '',
    task: entry?.task ?? '',
    description: entry?.description ?? '',
    start: hhmm(entry?.start_time),
    end: hhmm(entry?.end_time),
    hours: entry?.hours != null ? String(entry.hours) : '',
    taskStatus: entry?.task_status ?? 'In Progress',
    billable: entry?.billable ?? true,
  });
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const hoursOf = (r: Row) => (timed ? hoursBetween(r.start, r.end) : Number(r.hours) || 0);

  const toTask = (r: Row): TimesheetTask => {
    const project = r.project || projects[0];
    return {
      project,
      billable: r.billable && !project.startsWith('Internal'),
      task: r.task.trim(),
      description: r.description.trim(),
      start_time: timed && r.start ? r.start : null,
      end_time: timed && r.end ? r.end : null,
      hours: hoursOf(r),
      task_status: r.taskStatus || 'In Progress',
    };
  };

  const filled = rows.filter((r) => r.task.trim() && hoursOf(r) > 0);
  const total = filled.reduce((s, r) => s + hoursOf(r), 0);
  const problem =
    rows.some((r) => !r.task.trim() && hoursOf(r) > 0)
      ? 'Every task with hours needs a task name.'
      : total > 24
        ? 'A day cannot exceed 24 hours.'
        : '';

  const save = useMutation({
    mutationFn: (status: 'Draft' | 'Submitted') =>
      entry
        ? correctAndResubmit(entry.id, toTask(rows[0]))
        : batchFillTimesheet({
            format_name: format?.name ?? 'Default',
            status,
            days: [{ date, tasks: filled.map(toTask) }],
          }),
    onSuccess: (_res, status) => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      Alert.alert(
        'Timesheets',
        entry ? 'Timesheet corrected and resubmitted for approval' : status === 'Draft' ? 'Saved as draft' : 'Timesheet submitted',
      );
      router.back();
    },
  });

  const valid = filled.length > 0 && !problem;

  return (
    <Page>
      <Header title={entry ? 'Correct entry' : 'Log work'} />
      <Card style={{ gap: 16 }}>
        {!entry && (formats.data?.length ?? 0) > 1 ? (
          <Select
            label="Format"
            value={format?.name}
            onChange={setFormatName}
            options={(formats.data ?? []).map((f) => ({ label: f.name, value: f.name }))}
          />
        ) : null}
        {entry ? <Muted>Date: {date}</Muted> : <DateField label="Date" value={date} onChange={setDate} />}
      </Card>

      {rows.map((r, i) => (
        <Card key={i} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Task {i + 1}</Text>
            {rows.length > 1 ? (
              <Pressable onPress={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                <Text style={{ color: c.danger, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Select
            label="Project"
            value={r.project || projects[0]}
            onChange={(v) => update(i, { project: v })}
            options={projects.map((p) => ({ label: p, value: p }))}
          />
          <Field label="Task" value={r.task} onChangeText={(v) => update(i, { task: v })} placeholder="What did you work on?" />
          <Field label="Description" value={r.description} onChangeText={(v) => update(i, { description: v })} placeholder="Optional" />
          {timed ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <DateField label="Start" mode="time" value={r.start} onChange={(v) => update(i, { start: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="End" mode="time" value={r.end} onChange={(v) => update(i, { end: v })} />
              </View>
            </View>
          ) : (
            <Field label="Hours" value={r.hours} onChangeText={(v) => update(i, { hours: v })} keyboardType="decimal-pad" placeholder="e.g. 2.5" />
          )}
          {timed ? <Muted>{hoursOf(r)} h</Muted> : null}
          <Select
            label="Task status"
            value={r.taskStatus}
            onChange={(v) => update(i, { taskStatus: v })}
            options={taskStatuses.map((s) => ({ label: s, value: s }))}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Billable</Text>
            <Switch value={r.billable} onValueChange={(v) => update(i, { billable: v })} />
          </View>
        </Card>
      ))}

      {!entry ? <Button title="+ Add another task" variant="outline" onPress={() => setRows((rs) => [...rs, { ...newRow(), task: '', description: '', start: '', end: '', hours: '' }])} /> : null}

      <Muted>Total: {total} h</Muted>
      {problem ? <ErrorText>{problem}</ErrorText> : null}
      {save.error ? <ErrorText>{errorMessage(save.error, 'Could not save the timesheet.')}</ErrorText> : null}
      <Button
        title={entry ? 'Resubmit' : 'Submit'}
        onPress={() => save.mutate('Submitted')}
        loading={save.isPending && save.variables === 'Submitted'}
        disabled={!valid}
      />
      {!entry ? (
        <Button
          title="Save as draft"
          variant="outline"
          onPress={() => save.mutate('Draft')}
          loading={save.isPending && save.variables === 'Draft'}
          disabled={!valid}
        />
      ) : null}
    </Page>
  );
}
