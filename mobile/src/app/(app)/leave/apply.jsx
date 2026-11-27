import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  applyForLeave,
  DAY_PARTS,
  loadEmployeeLeaveTypes,
  loadReasonCategories,
  loadTeamMembers,
  validateApplication,
} from '@/api/leave';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { DateField, Header, Page, Segments, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const MAX_FILES = 10;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
export default function ApplyLeaveScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [leaveType, setLeaveType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dayPart, setDayPart] = useState('Full day');
  const [reasonCategory, setReasonCategory] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [handoverTo, setHandoverTo] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: loadEmployeeLeaveTypes });
  const reasons = useQuery({ queryKey: ['leave', 'reason-categories'], queryFn: loadReasonCategories });
  const team = useQuery({ queryKey: ['leave', 'team-members'], queryFn: () => loadTeamMembers().catch(() => []) });
  // Backend validation while the form is filled (POST /leave/applications/validate), debounced like the web.
  const [check, setCheck] = useState(null);
  useEffect(() => {
    if (!leaveType || !from || !to) {
      setCheck(null);
      return;
    }
    const timer = setTimeout(() => {
      validateApplication({ leave_type: leaveType, from_date: from, to_date: to, day_part: dayPart })
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [leaveType, from, to, dayPart]);
  const calendarDays =
    from && to && to >= from
      ? Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1
      : 0;
  const approxDays = dayPart !== 'Full day' && calendarDays === 1 ? 0.5 : calendarDays;
  const days = typeof check?.days === 'number' ? check.days : approxDays;
  const selectedType = (types.data ?? []).find((t) => t.name === leaveType);
  const attachAfter = Number(selectedType?.attachmentAfterDays) || 0;
  const needsDoc = attachAfter > 0 && days > attachAfter && files.length === 0;
  const dateRangeValid = Boolean(from && to) && to >= from;
  const submit = useMutation({
    mutationFn: () =>
      applyForLeave(
        {
          leaveType,
          from,
          to,
          dayPart,
          reasonCategory,
          description: description.trim(),
          contactDuringLeave: contact,
          locationDuringLeave: location,
          handoverTo,
          handoverNotes,
        },
        files,
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      Alert.alert('Leave', `Leave request ${res?.id || ''} submitted successfully.`.replace('  ', ' '));
      router.back();
    },
    onError: (err) => setError(errorMessage(err, 'Could not submit leave request.')),
  });
  function onSubmit() {
    setError('');
    if (!leaveType || !from || !to || !reasonCategory || !description.trim()) {
      return setError('Please complete all required fields.');
    }
    if (!dateRangeValid) return setError('Please select valid leave dates.');
    if (needsDoc) return setError(`Attach a supporting document for ${leaveType} beyond ${attachAfter} day(s).`);
    submit.mutate();
  }
  async function pickFiles() {
    const res = await DocumentPicker.getDocumentAsync({ type: ALLOWED, multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    const next = [...files];
    for (const a of res.assets) {
      if (a.mimeType && !ALLOWED.includes(a.mimeType)) {
        Alert.alert('Attachment', `${a.name}: Only PDF, JPG, JPEG and PNG are allowed.`);
        continue;
      }
      if (a.size && a.size > MAX_SIZE) {
        Alert.alert('Attachment', `${a.name}: Maximum file size is 5 MB.`);
        continue;
      }
      if (!next.some((f) => f.name === a.name && f.size === a.size)) {
        next.push({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
      }
    }
    if (next.length > MAX_FILES) Alert.alert('Attachment', 'You can attach a maximum of 10 documents.');
    setFiles(next.slice(0, MAX_FILES));
  }
  return (
    <>
      <Header title="Apply for leave" />
      <Page>
        <Card style={{ gap: 14 }}>
          <Select
            label="Leave type *"
            value={leaveType}
            onChange={setLeaveType}
            options={(types.data ?? []).map((t) => ({ label: t.name, value: t.name }))}
            placeholder={types.isLoading ? 'Loading…' : 'Choose leave type'}
          />
          {types.error ? <ErrorText>{errorMessage(types.error, 'Could not load leave types.')}</ErrorText> : null}
          <DateField
            label="From *"
            value={from}
            onChange={(v) => {
              setFrom(v);
              if (!to || to < v || dayPart !== 'Full day') setTo(v);
            }}
          />
          <DateField
            label="To *"
            value={to}
            onChange={(v) => {
              setTo(v);
              if (v !== from && dayPart !== 'Full day') setDayPart('Full day');
            }}
          />
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Day part</Text>
            <Segments
              value={dayPart}
              options={DAY_PARTS.map((d) => ({ label: d, value: d }))}
              onChange={(v) => {
                setDayPart(v);
                if (v !== 'Full day' && from) setTo(from);
              }}
            />
          </View>
          {days > 0 ? (
            <Muted>
              {days} day{days === 1 ? '' : 's'}
              {dayPart !== 'Full day' ? ' · half day' : ''}
            </Muted>
          ) : null}
          {check?.errors?.map((e, i) => (
            <ErrorText key={`e${i}`}>{String(e)}</ErrorText>
          ))}
          {check?.warnings?.map((w, i) => (
            <Text key={`w${i}`} style={{ color: c.warning, fontSize: 14 }}>
              {String(w)}
            </Text>
          ))}
        </Card>

        <Card style={{ gap: 14 }}>
          <Select
            label="Reason category *"
            value={reasonCategory}
            onChange={setReasonCategory}
            options={reasons.data ?? []}
            placeholder={reasons.isLoading ? 'Loading…' : 'Choose a reason'}
          />
          <Field
            label="Description *"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Reason for your leave"
          />
          <Field label="Contact during leave" value={contact} onChangeText={setContact} keyboardType="phone-pad" />
          <Field label="Location during leave" value={location} onChangeText={setLocation} />
        </Card>

        <Card style={{ gap: 14 }}>
          <Select
            label="Handover to"
            value={handoverTo}
            onChange={setHandoverTo}
            options={(team.data ?? []).map((m) => ({
              label: m.designation ? `${m.name} · ${m.designation}` : m.name,
              value: String(m.id),
            }))}
            placeholder="Optional"
          />
          <Field label="Handover notes" value={handoverNotes} onChangeText={setHandoverNotes} multiline />
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>
            Supporting documents{attachAfter > 0 ? ` (required beyond ${attachAfter} day(s))` : ''}
          </Text>
          {files.map((f, i) => (
            <View key={`${f.name}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Muted style={{ flex: 1 }}>{f.name}</Muted>
              <Pressable onPress={() => setFiles(files.filter((_, j) => j !== i))}>
                <Text style={{ color: c.danger }}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Button title="Attach file" variant="outline" onPress={pickFiles} />
          <Muted style={{ fontSize: 12 }}>PDF, JPG or PNG · max 5 MB each · up to 10 files</Muted>
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button title="Submit request" onPress={onSubmit} loading={submit.isPending} />
      </Page>
    </>
  );
}
