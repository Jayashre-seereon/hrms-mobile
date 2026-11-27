import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { getOpenPosts, REFERRAL_RELATIONS, submitReferral } from '@/api/referrals';
import { errorMessage } from '@/lib/api';
import { profileOf, useSession } from '@/store/session';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
export default function NewReferralScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = profileOf(useSession((s) => s.me));
  const jobs = useQuery({ queryKey: ['referrals', 'open-posts'], queryFn: getOpenPosts });
  const [candidateName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState(REFERRAL_RELATIONS[0]);
  const [jobId, setJobId] = useState('');
  const [skills, setSkills] = useState('');
  const [experienceYears, setExperience] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const jobOptions = (jobs.data ?? []).map((j) => ({
    value: String(j.id),
    label: [j.title || j.jobTitle || j.job_title || 'Open role', j.location || j.location_name]
      .filter(Boolean)
      .join(' · '),
  }));
  const submit = useMutation({
    mutationFn: () => {
      const job = (jobs.data ?? []).find((j) => String(j.id) === jobId);
      return submitReferral({
        candidateName: candidateName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        relationship,
        jobId,
        jobTitle: job?.title || job?.jobTitle || job?.job_title || 'Open Role',
        skills: skills.trim() || undefined,
        experienceYears: Number(experienceYears) || 0,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
      Alert.alert(
        'Referral',
        `Referral submitted. ${candidateName.trim()} has been added to the recruitment pipeline.`,
      );
      router.back();
    },
    onError: (e) => setError(errorMessage(e, 'Could not submit the referral.')),
  });
  const onSubmit = () => {
    if (!candidateName.trim() || !email.trim() || !jobId)
      return setError('Candidate name, valid email, and job post are required.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (me.email && String(me.email).toLowerCase() === email.trim().toLowerCase())
      return setError('You cannot refer yourself for open job posts.');
    setError('');
    submit.mutate();
  };
  return (
    <Page>
      <Header title="Refer a candidate" />
      <Card style={{ gap: 16 }}>
        <Field label="Candidate name" value={candidateName} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Select
          label="Relationship"
          value={relationship}
          options={REFERRAL_RELATIONS.map((r) => ({ label: r, value: r }))}
          onChange={setRelationship}
        />
        <Select
          label="Job post"
          value={jobId}
          options={jobOptions}
          onChange={setJobId}
          placeholder={jobs.isLoading ? 'Loading open posts…' : 'Select a job post'}
        />
        {jobs.error ? <ErrorText>{errorMessage(jobs.error, 'Could not load open job posts.')}</ErrorText> : null}
        {!jobs.isLoading && !jobs.error && jobOptions.length === 0 ? (
          <Muted>There are no open job posts right now.</Muted>
        ) : null}
        <Field label="Skills (optional)" value={skills} onChangeText={setSkills} placeholder="React, Node.js…" />
        <Field label="Experience (years)" value={experienceYears} onChangeText={setExperience} keyboardType="numeric" />
        <Field label="Note (optional)" value={note} onChangeText={setNote} multiline />
        <ErrorText>{error}</ErrorText>
        <Button title="Submit referral" onPress={onSubmit} loading={submit.isPending} />
      </Card>
    </Page>
  );
}
