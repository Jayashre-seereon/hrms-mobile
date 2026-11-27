import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { personName } from '@/api/admin/common';
import { getEmployees } from '@/api/admin/employees';
import { createReferralOnBehalf, getOpenPosts, getReferralMeta, REFERRAL_RELATIONS } from '@/api/referrals';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/** HR "Log referral on behalf" (web: ReferralsTab.jsx ReferralForm → POST /referrals). */
export default function NewAdminReferralScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [empSearch, setEmpSearch] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [candidateName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState(REFERRAL_RELATIONS[0]);
  const [jobId, setJobId] = useState('');
  const [skills, setSkills] = useState('');
  const [experienceYears, setExperience] = useState('');
  const [note, setNote] = useState('');
  const [bonusEligible, setBonusEligible] = useState(true);
  const [bonusAmount, setBonusAmount] = useState('25000');
  const [error, setError] = useState('');
  const meta = useQuery({ queryKey: ['admin', 'referrals', 'meta'], queryFn: getReferralMeta });
  const jobs = useQuery({ queryKey: ['referrals', 'open-posts'], queryFn: getOpenPosts });
  const employees = useQuery({
    queryKey: ['admin', 'employees', 'picker', empSearch.trim()],
    queryFn: () => getEmployees({ limit: 50, search: empSearch.trim() }),
  });
  const relations = meta.data?.relationships?.length ? meta.data.relationships : REFERRAL_RELATIONS;
  const empOptions = (employees.data?.items ?? []).map((e) => ({
    value: String(e.id),
    label: [personName(e), e.employee_code ?? e.employee_id].filter(Boolean).join(' · '),
  }));
  const jobOptions = (jobs.data ?? [])
    .filter((j) => (j.status ?? 'Open') === 'Open')
    .map((j) => ({
      value: String(j.id),
      label: [j.title || 'Open role', j.department_name].filter(Boolean).join(' · '),
    }));
  const submit = useMutation({
    mutationFn: () => {
      const job = (jobs.data ?? []).find((j) => String(j.id) === jobId);
      return createReferralOnBehalf({
        referrerId,
        candidateName: candidateName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        relationship,
        jobId,
        jobTitle: job?.title ?? '',
        skills: skills.trim(),
        experienceYears: Number(experienceYears) || 0,
        note: note.trim(),
        bonusEligible,
        bonusAmount: Number(bonusAmount) || 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'referrals'] });
      Alert.alert('Referral', `Referral logged successfully for ${candidateName.trim()}.`);
      router.back();
    },
    onError: (e) => setError(errorMessage(e, 'Could not log the referral.')),
  });
  const onSubmit = () => {
    if (!referrerId) return setError('Select the referring employee.');
    if (!candidateName.trim() || !email.trim() || !jobId)
      return setError('Candidate name, valid email, and job post are required.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setError('');
    submit.mutate();
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="Log referral" />
      <Page>
        <Muted>
          HR records a referral on behalf of an employee. The candidate is added to Recruitment (source: Referral).
        </Muted>
        <Card style={{ gap: 12 }}>
          <Field label="Find employee" value={empSearch} onChangeText={setEmpSearch} placeholder="Name or code" />
          <Select
            label="Referring employee"
            value={referrerId}
            options={empOptions}
            onChange={setReferrerId}
            placeholder={employees.isLoading ? 'Loading employees…' : 'Select employee'}
          />
          {employees.error ? (
            <ErrorText>{errorMessage(employees.error, 'Could not load employees.')}</ErrorText>
          ) : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <Field label="Candidate name" value={candidateName} onChangeText={setName} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Select
            label="Relationship"
            value={relationship}
            options={relations.map((r) => ({ label: r, value: r }))}
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
          <Field
            label="Experience (years)"
            value={experienceYears}
            onChangeText={setExperience}
            keyboardType="numeric"
          />
          <Field label="Key skills" value={skills} onChangeText={setSkills} placeholder="Comma separated" />
          <Field label="Note (optional)" value={note} onChangeText={setNote} multiline />
        </Card>
        <Card style={{ gap: 12 }}>
          <Pressable onPress={() => setBonusEligible((v) => !v)}>
            <Text style={{ color: c.text, fontWeight: '600' }}>
              {bonusEligible ? '☑' : '☐'} Eligible for referral bonus
            </Text>
          </Pressable>
          {bonusEligible ? (
            <Field label="Bonus amount (₹)" value={bonusAmount} onChangeText={setBonusAmount} keyboardType="numeric" />
          ) : null}
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button title="Log referral" onPress={onSubmit} loading={submit.isPending} />
      </Page>
    </View>
  );
}
