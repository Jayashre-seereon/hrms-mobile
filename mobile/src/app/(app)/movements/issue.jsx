import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { getEmployeeById, getEmployees } from '@/api/admin/employees';
import {
  createPromotion,
  employeeName,
  listPromotionDepartments,
  listPromotionDesignations,
  listPromotionPayGrades,
  money,
  pickPromotionFiles,
  PROMOTION_PURPOSES,
  uploadPromotionIssueAttachments,
} from '@/api/movements';
import { errorMessage } from '@/lib/api';
import { Button, Card, ErrorText, Field, Muted, Row } from '@/ui/components';
import { DateField, Header, Page, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
/**
 * "Issue a promotion" (web: PromotionsTab.jsx PromotionCreateForm): optional supporting files go to
 * POST /cases/promotions/issue-attachments first, then POST /cases/promotions with the same body as the web.
 * Sent straight to the employee — there is no approval step.
 */
export default function IssuePromotionScreen() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [empSearch, setEmpSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [purpose, setPurpose] = useState(PROMOTION_PURPOSES[0]);
  const [appraisal, setAppraisal] = useState('');
  const [designation, setDesignation] = useState('');
  const [grade, setGrade] = useState('');
  const [ctc, setCtc] = useState('');
  const [effective, setEffective] = useState('');
  const [department, setDepartment] = useState('');
  const [basis, setBasis] = useState('');
  const [letterBody, setLetterBody] = useState('');
  const [internalRemarks, setInternalRemarks] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const employees = useQuery({
    queryKey: ['admin', 'employees', 'picker', empSearch.trim()],
    queryFn: () => getEmployees({ limit: 100, search: empSearch.trim() }),
  });
  const list = employees.data?.items ?? [];
  const [picked, setPicked] = useState(null);
  const employee = list.find((e) => String(e.id) === employeeId) ?? picked;
  const details = useQuery({
    queryKey: ['employee', 'promotion-form', employeeId],
    queryFn: () => getEmployeeById(employeeId),
    enabled: !!employeeId,
  });
  const current = details.data ?? employee;
  const currentCTC = Number(current?.ctc ?? current?.compensation?.ctc ?? 0);
  const increase = currentCTC && Number(ctc) ? (((Number(ctc) - currentCTC) / currentCTC) * 100).toFixed(1) : null;
  const designations = useQuery({
    queryKey: ['designations', 'promotion', employee?.company_id],
    queryFn: () => listPromotionDesignations(employee.company_id),
    enabled: !!employee,
  });
  const grades = useQuery({
    queryKey: ['pay-grades', 'promotion', employee?.organization_id],
    queryFn: () => listPromotionPayGrades(employee.organization_id),
    enabled: !!employee,
  });
  const departments = useQuery({
    queryKey: ['departments', 'promotion', employee?.company_id],
    queryFn: () => listPromotionDepartments(employee.company_id),
    enabled: !!employee?.company_id,
  });
  const selectedGrade = (grades.data ?? []).find((g) => g.grade_code === grade);
  const ctcValue = Number(ctc);
  const gradeRangeError =
    selectedGrade &&
    ctcValue > 0 &&
    (ctcValue < Number(selectedGrade.minimum_ctc) || ctcValue > Number(selectedGrade.maximum_ctc));
  const submit = useMutation({
    mutationFn: async () => {
      const attachments = files.length
        ? ((await uploadPromotionIssueAttachments(employeeId, files)).attachments ?? [])
        : [];
      return createPromotion({
        employee_id: employeeId,
        purpose,
        appraisal_ref: appraisal || null,
        basis: basis.trim(),
        from_designation: current?.designation || null,
        to_designation: designation.trim(),
        from_grade: current?.grade || null,
        to_grade: grade || null,
        from_ctc: currentCTC || null,
        to_ctc: ctc ? Number(ctc) : null,
        effective_from: effective,
        letter_type: 'Promotion Letter',
        letter_ref: null,
        letter_file_url: null,
        letter_body: letterBody.trim() || null,
        new_department: department.trim() || null,
        internal_remarks: internalRemarks.trim() || null,
        attachments,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['promotions'] });
      Alert.alert(
        'Promotion',
        data?.email_status === 'SENT'
          ? 'Promotion issued and email sent to the employee.'
          : 'Promotion issued, but employee email delivery needs attention.',
      );
      router.back();
    },
    onError: (e) => setError(errorMessage(e, 'Could not issue the promotion.')),
  });
  const onSubmit = () => {
    if (!employeeId || !basis.trim() || !designation.trim() || !grade || !effective || !ctc)
      return setError('Complete the required promotion fields.');
    if (gradeRangeError)
      return setError(
        `Annual CTC must be between ${money(selectedGrade.minimum_ctc)} and ${money(selectedGrade.maximum_ctc)} for ${selectedGrade.grade_code}.`,
      );
    setError('');
    submit.mutate();
  };
  const needEmployee = !employee ? 'Select an employee first' : null;
  return (
    <View style={{ flex: 1 }}>
      <Header title="Issue promotion" />
      <Page>
        <Muted>Promotion details are sent directly to the employee. There is no approval step.</Muted>
        <Card style={{ gap: 12 }}>
          <Field label="Find employee" value={empSearch} onChangeText={setEmpSearch} placeholder="Name or code" />
          <Select
            label="Employee *"
            value={employeeId}
            options={list.map((e) => ({
              value: String(e.id),
              label: [e.employee_code, employeeName(e), e.department].filter(Boolean).join(' · '),
            }))}
            onChange={(v) => {
              setEmployeeId(v);
              setPicked(list.find((e) => String(e.id) === v) ?? null);
              setDesignation('');
              setGrade('');
              setDepartment('');
            }}
            placeholder={employees.isLoading ? 'Loading employees…' : 'Select employee'}
          />
          {employees.error ? <ErrorText>{errorMessage(employees.error, 'Could not load employees.')}</ErrorText> : null}
          {employee ? (
            <View>
              <Row label="Company" value={employee.company_name} />
              <Row label="Current role" value={current?.designation} />
              <Row label="Department" value={current?.department ?? employee.department} />
              <Row label="Current grade" value={current?.grade} />
              <Row label="Current annual CTC" value={money(currentCTC || null)} />
            </View>
          ) : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <Select
            label="Promotion type"
            value={purpose}
            options={PROMOTION_PURPOSES.map((p) => ({ label: p, value: p }))}
            onChange={setPurpose}
          />
          <Field label="Linked appraisal (optional)" value={appraisal} onChangeText={setAppraisal} />
          <Select
            label="New designation *"
            value={designation}
            options={(designations.data ?? []).map((d) => ({
              value: d.designation_name,
              label: [d.designation_name, d.department_name].filter(Boolean).join(' · '),
            }))}
            onChange={setDesignation}
            placeholder={needEmployee ?? (designations.isLoading ? 'Loading designations…' : 'Select designation')}
          />
          {designations.error ? (
            <ErrorText>{errorMessage(designations.error, 'Unable to load designations.')}</ErrorText>
          ) : null}
          <Select
            label="New pay grade *"
            value={grade}
            options={(grades.data ?? []).map((g) => ({
              value: g.grade_code,
              label: `${g.grade_code} · ${g.band ?? ''} (${money(g.minimum_ctc)} – ${money(g.maximum_ctc)})`,
            }))}
            onChange={setGrade}
            placeholder={needEmployee ?? (grades.isLoading ? 'Loading pay grades…' : 'Select pay grade')}
          />
          {grades.error ? <ErrorText>{errorMessage(grades.error, 'Unable to load pay grades.')}</ErrorText> : null}
          <Field
            label="New annual CTC *"
            value={ctc}
            onChangeText={setCtc}
            keyboardType="numeric"
            error={
              gradeRangeError
                ? `Must be between ${money(selectedGrade.minimum_ctc)} and ${money(selectedGrade.maximum_ctc)}`
                : undefined
            }
          />
          {increase != null ? <Muted>Increase: {increase}%</Muted> : null}
          <DateField
            label="Effective date *"
            value={effective}
            onChange={setEffective}
          />
          <Select
            label="New department (optional)"
            value={department}
            options={[
              { value: '', label: `Keep current department${current?.department ? ` (${current.department})` : ''}` },
              ...(departments.data ?? []).map((d) => ({ value: d.department_name, label: d.department_name })),
            ]}
            onChange={setDepartment}
            placeholder={needEmployee ?? 'Keep current department'}
          />
        </Card>
        <Card style={{ gap: 12 }}>
          <Field label="Basis / justification *" value={basis} onChangeText={setBasis} multiline />
          <Field
            label="Promotion letter body"
            value={letterBody}
            onChangeText={setLetterBody}
            multiline
            placeholder="Optional; a standard letter is generated if left blank"
          />
          <Field label="Internal remarks (HR only)" value={internalRemarks} onChangeText={setInternalRemarks} multiline />
          <Button
            title={files.length ? `${files.length} supporting file(s) attached` : 'Attach supporting files (PDF/images)'}
            variant="outline"
            onPress={async () => setFiles(await pickPromotionFiles(files))}
          />
          {files.map((f, i) => (
            <Pressable key={`${f.name}-${i}`} onPress={() => setFiles(files.filter((_, j) => j !== i))}>
              <Text style={{ color: c.muted }}>✕ {f.name}</Text>
            </Pressable>
          ))}
          <Muted style={{ fontSize: 12 }}>
            The promotion letter and selected files are emailed to the employee when you issue the promotion.
          </Muted>
        </Card>
        <ErrorText>{error}</ErrorText>
        <Button
          title="Issue and email to employee"
          onPress={onSubmit}
          loading={submit.isPending}
          disabled={Boolean(gradeRangeError)}
        />
      </Page>
    </View>
  );
}
