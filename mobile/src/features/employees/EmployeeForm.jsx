/**
 * Employee Add / Edit form — mobile version of the web's AddEmployeeDialog
 * (src/features/employees/views/EmployeesView.jsx). Same tabs, fields, validation and API calls;
 * the tabs become a horizontal chip bar and the save button sits at the bottom of the screen.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEmployee, patchEmployeeForm } from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { useAccess, useScope } from '@/lib/access';
import { useSession } from '@/store/session';
import { Button, Card, ErrorText, Field, Muted } from '@/ui/components';
import { DateField, Select } from '@/ui/kit';
import { useColors } from '@/ui/theme';
import { buildEmployeeForm, emptyPrevJob, initialValues, withWorkEmail } from './buildEmployeeForm';
import {
  ACCOUNT_TYPES,
  ALLOWED_FILE_TYPES,
  BLOOD_GROUPS,
  DOCUMENTS,
  EMPLOYMENT_TYPES,
  FORM_TO_API,
  GENDERS,
  isUuid,
  MARITAL_STATUSES,
  MAX_FILE_SIZE,
  NONE,
  NOTICE_PERIODS,
  PASSBOOK_DOC,
  PAY_MODES,
  PENSION_SCHEMES,
  PREV_DOCUMENTS,
  PROBATION_PERIODS,
  SKILL_CATEGORIES,
  staffLabel,
  TABS,
  tabOfField,
  WAGE_TYPES,
  WORK_MODES,
} from './constants';
import { useEmployeeFormOptions } from './useEmployeeFormOptions';
import { generateWorkEmail, isDuplicateWorkEmail, normalizeWorkEmailPrefix } from './validation';

const API_TO_FORM = Object.fromEntries(Object.entries(FORM_TO_API).map(([f, a]) => [a, f]));

/** Session ids the web keeps in its store (organizationId / companyId / branchId) — read from /me. */
function sessionIds(me) {
  const m = me ?? {};
  const pick = (...vals) => vals.find((x) => isUuid(String(x ?? ''))) ?? '';
  return {
    sessionOrgId: pick(m.organization_id, m.user?.organization_id, m.organization?.id, m.employee?.organization_id),
    sessionCompanyId: pick(m.company_id, m.user?.company_id, m.company?.id, m.employee?.company_id),
    sessionBranchId: pick(m.branch_id, m.user?.branch_id, m.branch?.id, m.employee?.branch_id),
  };
}

function SectionTitle({ title, desc }) {
  const c = useColors();
  return (
    <View style={{ gap: 2, marginTop: 4 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      {desc ? <Muted style={{ fontSize: 13 }}>{desc}</Muted> : null}
    </View>
  );
}

function Toggle({ label, value, onChange }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14, flex: 1 }}>{label}</Text>
      <Switch value={!!value} onValueChange={onChange} />
    </View>
  );
}

/** Pick one PDF / JPG / PNG (max 5 MB) — the web form's FileUpload. */
function FileRow({ label, file, existing, onPick, onRemove }) {
  const c = useColors();
  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ALLOWED_FILE_TYPES, copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (!a) return;
    if (a.mimeType && !ALLOWED_FILE_TYPES.includes(a.mimeType)) {
      Alert.alert(label, 'Only PDF, JPG and PNG files are allowed.');
      return;
    }
    if (a.size && a.size > MAX_FILE_SIZE) {
      Alert.alert(label, 'The file is larger than 5 MB.');
      return;
    }
    onPick({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
  };
  const status = file
    ? `${file.name}${file.size ? ` · ${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''} · Selected`
    : existing
      ? `${existing.file_name || 'Uploaded'} · on file (pick to replace)`
      : 'PDF, JPG, PNG · max 5 MB';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <Ionicons name={file || existing ? 'document-attach' : 'document-outline'} size={22} color={file ? c.primary : c.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
        <Muted style={{ fontSize: 12 }}>{status}</Muted>
      </View>
      {file ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={c.danger} />
        </Pressable>
      ) : null}
      <Pressable onPress={pick} hitSlop={8}>
        <Text style={{ color: c.primary, fontWeight: '600' }}>{file || existing ? 'Change' : 'Upload'}</Text>
      </Pressable>
    </View>
  );
}

export default function EmployeeForm({ employee, existingDocs = {} }) {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = !!employee;
  const me = useSession((s) => s.me);
  const { role } = useAccess();
  const scope = useScope();

  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
  const isCompanyAdmin = role === 'COMPANY_ADMIN';
  const isBranchAdmin = role === 'BRANCH_ADMIN' || role === 'BRANCHADMIN';
  const isEmployee = role === 'EMPLOYEE';
  const ids = sessionIds(me);
  // Super Admin works inside the company picked in the app (X-Company-Id) — that is the session company.
  const sessionCompanyId = isSuperAdmin ? scope.companyId || '' : ids.sessionCompanyId;
  const access = { isSuperAdmin, isCompanyAdmin, isBranchAdmin, ...ids, sessionCompanyId };

  const [v, setV] = useState(() => initialValues(employee, { sessionCompanyId, sessionBranchId: ids.sessionBranchId }));
  const initialRef = useRef(JSON.stringify(v));
  const [tab, setTab] = useState('personal');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [emailAttempt, setEmailAttempt] = useState(0);
  const scrollRef = useRef(null);

  const set = (key) => (value) => setV((p) => ({ ...p, [key]: value }));
  const companyScope = isSuperAdmin ? (v.placementMode === 'company' ? v.companyId : '') : sessionCompanyId;
  const workEmailCompanyId = isSuperAdmin ? v.companyId : sessionCompanyId;

  const options = useEmployeeFormOptions({
    companyId: companyScope,
    orgId: ids.sessionOrgId,
    isSuperAdmin,
    workEmailCompanyId,
    isEdit,
  });

  const generatedWorkEmail = useMemo(
    () =>
      generateWorkEmail({
        first: v.firstName,
        last: v.lastName,
        org: options.orgName,
        domain: normalizeWorkEmailPrefix(options.workEmailPrefix),
        attempt: emailAttempt,
      }),
    [v.firstName, v.lastName, options.orgName, options.workEmailPrefix, emailAttempt],
  );

  // A new employee always starts on the built-in Employee Self-Service role (web rule).
  const defaultRole =
    options.roles.find((r) => /^employee self/i.test(r.name)) ?? options.roles.find((r) => /^employee/i.test(r.name));
  const roleName = isEdit ? v.roleName : (defaultRole?.name ?? v.roleName);
  const roleOptions = (options.roles.length ? options.roles.map((r) => r.name) : ['Employee']).map((r) => ({
    label: r,
    value: r,
  }));

  /** Error text for a form field: server error (by API name) wins. */
  const err = (key) => errors[FORM_TO_API[key] ?? key];
  const f = (key, label, props = {}) => (
    <Field label={label} value={String(v[key] ?? '')} onChangeText={set(key)} error={err(key)} {...props} />
  );
  const sel = (key, label, list, props = {}) => (
    <Select label={label} value={v[key] || null} options={list} onChange={set(key)} error={err(key)} {...props} />
  );

  const setDoc = (name, file) =>
    setV((p) => {
      const docFiles = { ...p.docFiles };
      if (file) docFiles[name] = file;
      else delete docFiles[name];
      return { ...p, docFiles };
    });
  const setPrev = (i, patch) =>
    setV((p) => ({ ...p, experience: p.experience.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const goTab = (t) => {
    setTab(t);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };

  async function save() {
    if (submitting) return;
    if (isEmployee) {
      Alert.alert('Employees', 'Employees are not authorized to create or onboard employees.');
      return;
    }
    const built = buildEmployeeForm(
      { ...v, roleName },
      {
        employee,
        roles: options.roles,
        departments: options.departments,
        designations: options.designations,
        access,
        workEmail: generatedWorkEmail,
      },
    );
    if (built.error) {
      Alert.alert(isEdit ? 'Edit employee' : 'Add employee', built.error);
      goTab(built.tab);
      return;
    }
    if (built.noChanges) {
      Alert.alert('Edit employee', 'No changes to save.');
      router.back();
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      let saved;
      let workEmail = built.workEmail;
      if (isEdit) {
        saved = await patchEmployeeForm(employee.id, built.formData);
      } else {
        // If the generated work email is already registered, try a slightly different one (web: up to 5 tries).
        let attempt = emailAttempt;
        for (;;) {
          try {
            saved = await createEmployee(built.formData);
            break;
          } catch (e) {
            if (!isDuplicateWorkEmail(e) || attempt >= 5) throw e;
            attempt += 1;
            workEmail = generateWorkEmail({
              first: v.firstName,
              last: v.lastName,
              org: options.orgName,
              domain: normalizeWorkEmailPrefix(options.workEmailPrefix),
              attempt,
            });
            withWorkEmail(built.formData, workEmail);
            setEmailAttempt(attempt);
          }
        }
        workEmail = saved?.work_email || workEmail;
      }

      await qc.invalidateQueries({ queryKey: ['admin', 'employees'] });
      await qc.invalidateQueries({ queryKey: ['admin', 'employee'] });

      const name = saved?.first_name
        ? `${saved.first_name} ${saved.last_name ?? ''}`.trim()
        : `${v.firstName} ${v.lastName}`.trim();
      if (isEdit) {
        Alert.alert('Employee updated', `${name} updated successfully`);
      } else {
        const code = saved?.employee_code || saved?.id || '';
        const creds = saved?.credentials_email_queued
          ? `Credentials sent to ${saved.credentials_email_to || v.personalEmail}.`
          : `The credentials email was not sent. Temporary password: ${built.tempPassword}`;
        Alert.alert('Employee created', `${name} created successfully (Employee ${code})\nLogin: ${workEmail}\n\n${creds}`);
      }
      initialRef.current = JSON.stringify(v);
      router.back();
    } catch (e) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message;
      if (Array.isArray(detail)) {
        // One entry per invalid field: mark them all and jump to the first one's tab.
        const next = {};
        detail.forEach((d) => {
          const field = (d.loc ?? []).filter((x) => x !== 'body').pop();
          if (field && !next[field]) next[field] = d.msg;
        });
        setErrors(next);
        const first = Object.keys(next)[0];
        if (first) goTab(tabOfField(first));
        Alert.alert(
          'Please check the form',
          detail.length === 1 ? detail[0].msg : `${detail.length} fields need attention — see the highlighted fields.`,
        );
      } else {
        Alert.alert(isEdit ? 'Update failed' : 'Create failed', errorMessage(e, `Could not ${isEdit ? 'update' : 'create'} employee. Please try again.`));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Errors that have no field on screen (e.g. role_id, organization_id) are listed at the top.
  const unplaced = Object.entries(errors).filter(([k]) => !API_TO_FORM[k] && !/^prev\d+_/.test(k) && !DOCUMENTS.some(([d]) => d === k));

  const deptOptions = [{ label: '— None —', value: NONE }, ...options.departments.map((d) => ({ label: d.name, value: String(d.id) }))];
  const desigOptions = [{ label: '— None —', value: NONE }, ...options.designations.map((d) => ({ label: d.name, value: String(d.id) }))];
  const managerOptions = [{ label: 'No reporting manager', value: NONE }, ...options.managers.map((e) => ({ label: staffLabel(e), value: e.id }))];
  const hrOptions = [{ label: 'No HR assigned', value: NONE }, ...options.hrs.map((e) => ({ label: staffLabel(e), value: e.id }))];
  const shiftOptions = options.shifts.map((x) => ({ label: `${x.name}${x.start ? ` (${x.start} – ${x.end})` : ''}`, value: String(x.id) }));
  const gradeOptions = options.grades.map((g) => ({ label: g.grade_name ? `${g.grade_code} — ${g.grade_name}` : g.grade_code, value: g.grade_code }));
  const branchOptions = [{ label: 'Company level (No branch)', value: NONE }, ...options.branches.map((b) => ({ label: b.name ?? b.branch_name ?? b.code, value: b.id }))];
  const companyOptions = options.companies.map((co) => ({ label: `${co.name}${co.code ? ` (${co.code})` : ''}`, value: co.id }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.card }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, gap: 8 }}>
            {TABS.map((t) => {
              const active = t.value === tab;
              const bad = Object.keys(errors).some((k) => tabOfField(k) === t.value);
              return (
                <Pressable
                  key={t.value}
                  onPress={() => goTab(t.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? c.primary : 'transparent',
                    borderWidth: 1,
                    borderColor: bad ? c.danger : active ? c.primary : c.border,
                  }}>
                  <Text style={{ color: active ? '#fff' : bad ? c.danger : c.text, fontWeight: '600', fontSize: 13 }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {unplaced.length ? (
            <Card style={{ borderColor: c.danger }}>
              {unplaced.map(([k, msg]) => (
                <ErrorText key={k}>{`${k}: ${msg}`}</ErrorText>
              ))}
            </Card>
          ) : null}

          {tab === 'personal' ? (
            <>
              <SectionTitle title="Personal Information" desc="Basic details about the employee" />
              {f('firstName', 'First Name *', { autoCapitalize: 'words' })}
              {f('lastName', 'Last Name *', { autoCapitalize: 'words' })}
              <DateField label="Date of Birth *" value={v.dob} onChange={set('dob')} error={err('dob')} />
              {sel('gender', 'Gender', GENDERS)}
              {sel('maritalStatus', 'Marital Status', MARITAL_STATUSES)}
              {sel('bloodGroup', 'Blood Group', BLOOD_GROUPS)}
              {f('nationality', 'Nationality', { placeholder: 'Indian' })}
              {f('religion', 'Religion (Optional)')}
              {f('fatherSpouse', 'Father / Mother / Spouse Name (Optional)', { maxLength: 100, placeholder: 'Full name' })}
              {f('placeOfBirth', 'Place of Birth (Optional)', { maxLength: 100, placeholder: 'Town / village' })}
              {f('identificationMark', 'Mark of Identification (Optional)', { maxLength: 200, multiline: true })}

              <SectionTitle title="Contact" desc="How we reach the employee" />
              {f('personalEmail', 'Personal Email *', { keyboardType: 'email-address', autoCapitalize: 'none', placeholder: 'ananya@gmail.com' })}
              <Field
                label="Work Email"
                value={isEdit ? v.workEmail : generatedWorkEmail}
                editable={false}
                error={err('workEmail')}
                placeholder={isEdit ? '' : 'Generated from the name'}
              />
              {!isEdit ? <Muted style={{ fontSize: 12, marginTop: -8 }}>Generated automatically and used as the login. It cannot be changed later.</Muted> : null}
              {f('phone', 'Mobile Number *', { keyboardType: 'phone-pad', placeholder: '+91 98450 12345' })}
              {f('whatsapp', 'WhatsApp Number', { keyboardType: 'phone-pad', placeholder: '+91 98450 12345' })}
              {f('emergencyName', 'Emergency Contact Name', { placeholder: 'Full name' })}
              {f('emergencyPhone', 'Emergency Contact Number', { keyboardType: 'phone-pad', placeholder: '+91 98450 00000' })}
              {f('emergencyRelation', 'Emergency Contact Relationship', { maxLength: 50, placeholder: 'e.g. Spouse, Father' })}

              <SectionTitle title="Address" />
              {f('currentAddress', 'Current Address', { multiline: true })}
              {f('permanentAddress', 'Permanent Address', { multiline: true })}

              <SectionTitle title="Social Profiles" />
              {f('linkedin', 'LinkedIn', { autoCapitalize: 'none', placeholder: 'linkedin.com/in/…' })}
              {f('github', 'GitHub', { autoCapitalize: 'none', placeholder: 'github.com/…' })}
              {f('twitter', 'X / Twitter', { autoCapitalize: 'none', placeholder: 'x.com/…' })}
              {f('website', 'Personal Website', { autoCapitalize: 'none', placeholder: 'https://…' })}
            </>
          ) : null}

          {tab === 'previous' ? (
            <>
              <SectionTitle title="Previous Employment" desc="Past employers with documents" />
              {v.experience.map((b, i) => (
                <Card key={i} style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>Employer #{i + 1}</Text>
                    {v.experience.length > 1 ? (
                      <Pressable onPress={() => setV((p) => ({ ...p, experience: p.experience.filter((_, j) => j !== i) }))}>
                        <Text style={{ color: c.danger, fontWeight: '600' }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Field label="Company Name *" value={b.company} onChangeText={(t) => setPrev(i, { company: t })} placeholder="e.g. Infosys Ltd." error={errors[`prev${i + 1}_company`]} />
                  <Field label="Designation *" value={b.role} onChangeText={(t) => setPrev(i, { role: t })} placeholder="e.g. Senior Engineer" error={errors[`prev${i + 1}_role`]} />
                  <Field label="From (YYYY-MM)" value={b.from} onChangeText={(t) => setPrev(i, { from: t })} placeholder="2021-04" error={errors[`prev${i + 1}_from`]} />
                  <Field label="To (YYYY-MM)" value={b.to} onChangeText={(t) => setPrev(i, { to: t })} placeholder="2023-08" error={errors[`prev${i + 1}_to`]} />
                  <Field label="CTC (Annual)" value={b.ctc} onChangeText={(t) => setPrev(i, { ctc: t })} keyboardType="numeric" placeholder="1200000" error={errors[`prev${i + 1}_ctc`]} />
                  <Field label="Reason for Leaving" value={b.reason} onChangeText={(t) => setPrev(i, { reason: t })} placeholder="Career growth" error={errors[`prev${i + 1}_reason`]} />
                  <Muted style={{ fontSize: 12, fontWeight: '600', textTransform: 'uppercase' }}>Documents</Muted>
                  {PREV_DOCUMENTS.map(([type, label]) => (
                    <FileRow
                      key={type}
                      label={label}
                      file={b.files?.[type]}
                      existing={b.documents?.find((d) => d.document_type === type)}
                      onPick={(file) => setPrev(i, { files: { ...b.files, [type]: file } })}
                      onRemove={() => {
                        const files = { ...b.files };
                        delete files[type];
                        setPrev(i, { files });
                      }}
                    />
                  ))}
                </Card>
              ))}
              <Button title="+ Add another employer" variant="outline" onPress={() => setV((p) => ({ ...p, experience: [...p.experience, emptyPrevJob()] }))} />

              <SectionTitle title="Education" />
              {f('qualification', 'Highest Qualification', { placeholder: 'B.Tech — Computer Science' })}
              {f('institution', 'Institution', { placeholder: 'IIT Bombay' })}
              {f('yearOfPassing', 'Year of Passing', { keyboardType: 'number-pad', placeholder: '2019' })}
              {f('eduScore', 'Grade / CGPA', { placeholder: '8.4' })}
            </>
          ) : null}

          {tab === 'legal' ? (
            <>
              <SectionTitle title="Legal & Statutory" desc="Identity and statutory numbers" />
              {f('aadhaar', 'Aadhar Number', { keyboardType: 'number-pad', placeholder: '1234 5678 9012' })}
              {f('pan', 'PAN Number', { autoCapitalize: 'characters', placeholder: 'ABCDE1234F' })}
              {f('drivingLicence', 'Driving License No.', { autoCapitalize: 'characters', placeholder: 'KA01 20220001234' })}
              {f('passport', 'Passport No.', { autoCapitalize: 'characters', placeholder: 'M1234567' })}
              {f('uan', 'UAN (12 digits)', { keyboardType: 'number-pad', placeholder: '1000 1234 5678' })}
              {f('esiNo', 'ESI No. (10 digits)', { keyboardType: 'number-pad', maxLength: 10, placeholder: '10 digits' })}
              {f('pfMemberId', 'PF member ID', { maxLength: 30, placeholder: 'Optional' })}

              <SectionTitle title="Statutory Register" />
              {f('nominee', 'Nominee Name (Optional)', { maxLength: 100, placeholder: 'Full name' })}
              {sel('pensionScheme', 'Pension Scheme (Optional)', PENSION_SCHEMES)}
              {f('serviceBook', 'Service Book No. (Optional)', { maxLength: 30, placeholder: 'Optional' })}
              {f('familyDetails', 'Family Details (Optional)', { maxLength: 500, multiline: true })}

              <SectionTitle title="Documents" desc="PDF, JPG, PNG · max 5 MB each" />
              <Card style={{ gap: 0, paddingVertical: 8 }}>
                {DOCUMENTS.map(([name, label]) => (
                  <View key={name}>
                    <FileRow
                      label={label}
                      file={v.docFiles[name]}
                      existing={existingDocs[name]}
                      onPick={(file) => setDoc(name, file)}
                      onRemove={() => setDoc(name, null)}
                    />
                    {errors[name] ? <ErrorText>{errors[name]}</ErrorText> : null}
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {tab === 'bank' ? (
            <>
              <SectionTitle title="Bank Details" desc="Salary account" />
              {f('bankHolder', 'Account Holder Name', { placeholder: 'As per bank records' })}
              {f('bankName', 'Bank Name', { placeholder: 'HDFC Bank' })}
              {f('accountNo', 'Account Number', { keyboardType: 'number-pad', placeholder: '50100XXXXXXXX' })}
              {f('accountNo2', 'Re-enter Account Number', { keyboardType: 'number-pad', placeholder: 'Confirm' })}
              {f('ifsc', 'IFSC Code', { autoCapitalize: 'characters', placeholder: 'HDFC0001234' })}
              {f('bankBranch', 'Branch', { placeholder: 'Khandagiri, Bhubaneswar' })}
              {sel('accountType', 'Account Type', ACCOUNT_TYPES)}
              {sel('payMode', 'Payment Mode', PAY_MODES)}
              <SectionTitle title="Proof" />
              <Card style={{ paddingVertical: 8 }}>
                <FileRow
                  label={PASSBOOK_DOC[1]}
                  file={v.docFiles.passbook}
                  existing={existingDocs.passbook}
                  onPick={(file) => setDoc('passbook', file)}
                  onRemove={() => setDoc('passbook', null)}
                />
              </Card>
            </>
          ) : null}

          {tab === 'job' ? (
            <>
              <SectionTitle title="Job & Role" desc="Placement, role and compensation" />

              {isSuperAdmin ? (
                <>
                  <Select
                    label="Company Placement"
                    value={v.placementMode}
                    options={[
                      { label: 'Organisation level (No company)', value: 'org' },
                      { label: 'With company', value: 'company' },
                    ]}
                    onChange={(m) => setV((p) => ({ ...p, placementMode: m, ...(m === 'org' ? { companyId: '', branchId: '' } : {}) }))}
                  />
                  {v.placementMode === 'company' ? (
                    <>
                      <Select
                        label="Company *"
                        value={v.companyId || null}
                        options={companyOptions}
                        placeholder={options.loadingCompanies ? 'Loading companies…' : 'Select company'}
                        onChange={(id) => setV((p) => ({ ...p, companyId: id, branchId: '' }))}
                        error={err('companyId')}
                      />
                      <Select
                        label="Branch (Optional)"
                        value={v.branchId || NONE}
                        options={branchOptions}
                        onChange={(id) => set('branchId')(id === NONE ? '' : id)}
                        error={err('branchId')}
                      />
                    </>
                  ) : null}
                </>
              ) : isCompanyAdmin ? (
                <>
                  <Field label="Company (Locked to your session)" value={me?.company?.name ?? ''} editable={false} />
                  <Select
                    label="Branch (Optional)"
                    value={v.branchId || NONE}
                    options={branchOptions}
                    onChange={(id) => set('branchId')(id === NONE ? '' : id)}
                    error={err('branchId')}
                  />
                </>
              ) : isBranchAdmin ? (
                <>
                  <Field label="Company (Locked)" value={me?.company?.name ?? ''} editable={false} />
                  <Field label="Branch (Locked to your branch)" value={me?.branch?.name ?? ''} editable={false} />
                </>
              ) : null}

              <Field
                label={isEdit ? 'Employee ID' : 'Employee ID *'}
                value={v.employeeCode}
                onChangeText={set('employeeCode')}
                editable={!isEdit}
                maxLength={50}
                placeholder={isEdit ? '—' : 'e.g. 100243'}
                error={err('employeeCode')}
              />
              <DateField label="Date of Joining *" value={v.doj} onChange={set('doj')} error={err('doj')} />
              {sel('deptId', 'Department', deptOptions)}
              {sel('designationId', 'Designation', desigOptions)}
              {isEdit ? (
                <Select label="Role (Access)" value={v.roleName} options={roleOptions} onChange={set('roleName')} error={errors.role || errors.role_id} />
              ) : (
                <>
                  <Field label="Role (Access)" value={roleName} editable={false} />
                  <Muted style={{ fontSize: 12, marginTop: -8 }}>
                    Every new employee starts as Employee Self-Service. Assign other roles afterwards in Roles & Permissions.
                  </Muted>
                </>
              )}
              {sel('employmentType', 'Employment Type', EMPLOYMENT_TYPES)}
              {sel('managerId', 'Reporting Manager (Optional)', managerOptions, { value: v.managerId || NONE })}
              {sel('hrId', 'Assign HR (Optional)', hrOptions, { value: v.hrId || NONE })}
              {sel('noticeDays', 'Notice Period', NOTICE_PERIODS)}
              {sel('workMode', 'Work Location', WORK_MODES)}
              {sel('shiftId', 'Shift', shiftOptions, { placeholder: shiftOptions.length ? 'Select shift' : 'No shifts configured' })}

              <SectionTitle title="Compensation" />
              {sel('wageType', 'Wage type *', WAGE_TYPES)}
              {v.wageType === 'Monthly' ? f('ctc', 'Annual CTC (₹) *', { keyboardType: 'numeric' }) : null}
              {v.wageType === 'Daily' ? f('dailyRate', 'Daily rate (₹) *', { keyboardType: 'numeric' }) : null}
              {sel('probationMonths', 'Probation Period', PROBATION_PERIODS)}
              {sel('grade', 'Pay Grade', gradeOptions, { placeholder: gradeOptions.length ? 'Select grade' : 'No active pay grades' })}
              <Toggle label="Provident Fund (PF) applicable" value={v.pfApplicable} onChange={set('pfApplicable')} />
              <Toggle label="ESI applicable" value={v.esiApplicable} onChange={set('esiApplicable')} />
              {f('ptState', 'Professional tax state', { placeholder: 'e.g. Odisha' })}
              {sel('skillCategory', 'Skill category', SKILL_CATEGORIES)}

              {options.payComponents.length ? (
                <>
                  <SectionTitle title="Pay components (optional overrides)" />
                  {options.payComponents.map((pc) => (
                    <Field
                      key={pc.code}
                      label={`${pc.name || pc.code}${pc.calculation_type ? ` (${pc.calculation_type})` : ''}`}
                      value={String(v.payComponents?.[pc.code] ?? '')}
                      onChangeText={(t) => setV((p) => ({ ...p, payComponents: { ...p.payComponents, [pc.code]: t } }))}
                      keyboardType="numeric"
                      error={errors[`pc_${pc.code}`]}
                    />
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card, flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="outline" onPress={() => confirmLeave(router, initialRef.current !== JSON.stringify(v))} disabled={submitting} />
          </View>
          <View style={{ flex: 2 }}>
            <Button title={isEdit ? 'Save changes' : 'Create employee'} onPress={save} loading={submitting} disabled={isEmployee} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function confirmLeave(router, dirty) {
  if (!dirty) return router.back();
  Alert.alert('Discard changes?', 'You have unsaved changes.', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: () => router.back() },
  ]);
}

/** Exposed for the screens' header back-button guard. */
export { confirmLeave };
