import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { GRIEVANCE_CATEGORIES, GRIEVANCE_SEVERITIES, submitGrievance } from '@/api/complaints';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
const toOptions = (list) => list.map((v) => ({ label: v, value: v }));
export default function NewComplaintScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [category, setCategory] = useState('Payroll / salary dispute');
  const [severity, setSeverity] = useState('Medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [against, setAgainst] = useState('');
  const [isAnonymous, setAnonymous] = useState(false);
  const [error, setError] = useState('');
  const submit = useMutation({
    mutationFn: () =>
      submitGrievance({
        category,
        severity,
        subject: subject.trim(),
        description: description.trim(),
        against: against.trim() || undefined,
        isAnonymous,
        attachments: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      Alert.alert('Complaint', 'Grievance submitted. It has been routed to the right committee.');
      router.back();
    },
    onError: (e) => setError(errorMessage(e, 'Could not submit the grievance.')),
  });
  const onSubmit = () => {
    if (!subject.trim() || !description.trim()) return setError('Please enter both subject and description.');
    if (subject.trim().length > 150) return setError('Subject must be under 150 characters.');
    setError('');
    submit.mutate();
  };
  return (
    <Page>
      <Header title="Raise a complaint" />
      <Card style={{ gap: 16 }}>
        <Select label="Category" value={category} options={toOptions(GRIEVANCE_CATEGORIES)} onChange={setCategory} />
        <Select label="Severity" value={severity} options={toOptions(GRIEVANCE_SEVERITIES)} onChange={setSeverity} />
        <Field label="Against (optional)" value={against} onChangeText={setAgainst} placeholder="Person or team" />
        {category === 'Harassment (POSH)' ? (
          <Muted>POSH complaints go directly to the Internal Committee and are handled confidentially.</Muted>
        ) : null}
        <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={150} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>Submit anonymously</Text>
          <Switch value={isAnonymous} onValueChange={setAnonymous} />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title="Submit" onPress={onSubmit} loading={submit.isPending} />
      </Card>
    </Page>
  );
}
