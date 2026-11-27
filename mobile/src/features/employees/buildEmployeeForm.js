/**
 * Turns the form values into the multipart body the backend expects — a line-by-line port of the web's
 * AddEmployeeDialog.create() (src/features/employees/views/EmployeesView.jsx):
 * - create → POST /employees/form with every non-empty field
 * - edit   → PATCH /employees/{id}/form with ONLY the changed fields ("null" clears optional ones)
 */
import { isUuid, NONE, PENSION_NONE } from './constants';
import { makeTempPassword, validateHireInput } from './validation';

const s = (x) => String(x ?? '').trim();
const idOrEmpty = (x) => (x && x !== NONE ? x : '');

/** Values the inputs start with — from GET /employees/{id} when editing (web: `init`). */
export function initialValues(employee, { sessionCompanyId, sessionBranchId } = {}) {
  const e = employee ?? {};
  const isEdit = !!employee;
  const edu = e.education?.[0] ?? {};
  const experience = (e.previous_employments ?? []).map((x) => ({
    company: x.company_name ?? '',
    role: x.designation ?? '',
    from: x.from_month ?? '',
    to: x.to_month ?? '',
    ctc: x.ctc != null ? String(x.ctc) : '',
    reason: x.reason_for_leaving ?? '',
    documents: x.documents ?? [],
    files: {},
  }));
  return {
    firstName: e.first_name ?? '',
    lastName: e.last_name ?? '',
    dob: e.date_of_birth ?? '',
    gender: e.gender || '',
    maritalStatus: e.marital_status || '',
    bloodGroup: e.blood_group || '',
    nationality: isEdit ? e.nationality || '' : 'Indian',
    religion: e.religion ?? '',
    fatherSpouse: e.father_spouse_name ?? '',
    placeOfBirth: e.place_of_birth ?? '',
    identificationMark: e.identification_mark ?? '',
    personalEmail: e.personal_email ?? '',
    workEmail: e.work_email ?? '',
    phone: e.phone && e.phone !== '—' ? e.phone : '',
    whatsapp: e.whatsapp_number ?? '',
    emergencyName: e.emergency_contact_name ?? '',
    emergencyPhone: e.emergency_contact_phone ?? '',
    emergencyRelation: e.emergency_contact_relationship ?? '',
    currentAddress: e.current_address ?? '',
    permanentAddress: e.permanent_address ?? '',
    linkedin: e.linkedin_url ?? '',
    github: e.github_url ?? '',
    twitter: e.twitter_url ?? '',
    website: e.website_url ?? '',
    qualification: edu.qualification ?? '',
    institution: edu.institution ?? '',
    yearOfPassing: edu.year_of_passing != null ? String(edu.year_of_passing) : '',
    eduScore: edu.score ?? '',
    aadhaar: e.aadhaar_number ?? '',
    pan: e.pan_number ?? '',
    uan: e.uan_number ?? '',
    esiNo: e.esic_number ?? '',
    pfMemberId: e.pf_member_id ?? '',
    drivingLicence: e.driving_license_number ?? '',
    passport: e.passport_number ?? '',
    nominee: e.nominee_name ?? '',
    pensionScheme: e.pension_scheme || '',
    familyDetails: e.family_details ?? '',
    serviceBook: e.service_book_number ?? '',
    bankHolder: e.bank_account_holder_name ?? '',
    bankName: e.bank_name ?? '',
    accountNo: e.bank_account_number ?? '',
    accountNo2: e.bank_account_number ?? '',
    ifsc: e.ifsc_code ?? '',
    bankBranch: e.bank_branch ?? '',
    accountType: e.bank_account_type || 'savings',
    payMode: e.payment_mode || 'NEFT',
    employeeCode: e.employee_code ?? '',
    doj: e.date_of_joining ?? '',
    employmentType: e.employment_type || 'Full-time',
    noticeDays: e.notice_period_days != null ? String(e.notice_period_days) : '60',
    workMode: e.work_mode || 'office',
    probationMonths: e.probation_months != null ? String(e.probation_months) : '3',
    payFrequency: e.pay_frequency || '',
    grade: e.grade || '',
    // Compensation: Monthly (annual CTC) or Daily (daily rate). An old row with another wage type starts empty.
    wageType: isEdit ? (e.wage_type === 'Monthly' || e.wage_type === 'Daily' ? e.wage_type : '') : 'Monthly',
    ctc: e.ctc != null ? String(Math.round(Number(e.ctc))) : '',
    dailyRate: e.daily_rate != null ? String(e.daily_rate) : '',
    pfApplicable: e.pf_applicable !== false,
    esiApplicable: e.esi_applicable !== false,
    ptState: e.pt_state ?? '',
    skillCategory: e.skill_category || '',
    deptId: e.department_id ?? '',
    designationId: e.designation_id ?? '',
    roleName: e.role || 'Employee',
    managerId: e.manager_id ?? '',
    hrId: e.hr_partner_id ?? '',
    shiftId: e.shift_id ?? '',
    companyId: isEdit ? e.company_id || '' : sessionCompanyId || '',
    branchId: isEdit ? e.branch_id || '' : sessionBranchId || '',
    placementMode: (isEdit ? e.company_id : sessionCompanyId) ? 'company' : 'org',
    experience: experience.length ? experience : [emptyPrevJob()],
    initExperience: experience,
    payComponents: Object.fromEntries((e.pay_components ?? []).map((c) => [c.code, String(c.value ?? '')])),
    initPayComponents: Object.fromEntries((e.pay_components ?? []).map((c) => [c.code, c.value])),
    docFiles: {},
  };
}

export const emptyPrevJob = () => ({ company: '', role: '', from: '', to: '', ctc: '', reason: '', documents: [], files: {} });

/** RN FormData file part. */
const filePart = (f) => ({ uri: f.uri, name: f.name || 'document', type: f.mimeType || f.type || 'application/octet-stream' });

/**
 * Validates and builds the request. Returns { error, tab } on a validation problem, or
 * { formData, workEmail, tempPassword, noChanges }.
 */
export function buildEmployeeForm(v, ctx) {
  const { employee, roles, departments, designations, access, workEmail: generatedWorkEmail } = ctx;
  const isEdit = !!employee;
  const { isSuperAdmin, isCompanyAdmin, isBranchAdmin, sessionOrgId, sessionCompanyId, sessionBranchId } = access;

  const required = [
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['dob', 'Date of birth'],
    ['personalEmail', 'Personal email'],
    ['phone', 'Mobile number'],
    ['doj', 'Date of joining'],
    ...(isEdit ? [] : [['employeeCode', 'Employee ID']]),
  ];
  const missing = required.filter(([k]) => !s(v[k])).map(([, l]) => l);
  const wageType = v.wageType;
  if (wageType !== 'Monthly' && wageType !== 'Daily') missing.push('Wage type');
  else if (wageType === 'Monthly' && !(Number(v.ctc) > 0)) missing.push('Annual CTC');
  else if (wageType === 'Daily' && !(Number(v.dailyRate) > 0)) missing.push('Daily rate');
  if (isSuperAdmin && v.placementMode === 'company' && !isUuid(v.companyId)) missing.push('Company');
  if (missing.length) {
    return {
      error: `Complete the required fields: ${missing.join(', ')}`,
      tab: missing.some((m) => ['First name', 'Last name', 'Date of birth', 'Personal email', 'Mobile number'].includes(m))
        ? 'personal'
        : 'job',
    };
  }
  const fail = (error, tab) => ({ error, tab });

  const pan = s(v.pan).toUpperCase();
  const aadhaar = String(v.aadhaar ?? '').replace(/\s+/g, '');
  const uan = String(v.uan ?? '').replace(/\s+/g, '');
  const acct = String(v.accountNo ?? '').replace(/\s+/g, '');
  const ifsc = s(v.ifsc).toUpperCase();
  const esic = String(v.esiNo ?? '').replace(/\s+/g, '');

  if (aadhaar && aadhaar !== employee?.aadhaar_number && !/^\d{12}$/.test(aadhaar))
    return fail('Aadhaar number must be 12 digits', 'legal');
  if (pan && pan !== employee?.pan_number && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))
    return fail('PAN must be in the format ABCDE1234F', 'legal');
  if (uan && uan !== employee?.uan_number && !/^\d{12}$/.test(uan)) return fail('UAN must be 12 digits', 'legal');
  if (esic && esic !== employee?.esic_number && !/^\d{10}$/.test(esic)) return fail('ESIC number must be 10 digits', 'legal');
  if (acct && acct !== employee?.bank_account_number && !/^\d{9,18}$/.test(acct))
    return fail('Account number must be 9–18 digits', 'bank');
  if (acct && acct !== String(v.accountNo2 ?? '').replace(/\s+/g, ''))
    return fail('The re-entered account number does not match', 'bank');
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return fail('IFSC must look like HDFC0001234', 'bank');

  const workEmail = (isEdit ? s(v.workEmail) : s(generatedWorkEmail)) || s(v.personalEmail);
  if (!workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) return fail('Enter a valid work email address', 'personal');

  const localCtc = wageType === 'Daily' ? Number(v.dailyRate) * 26 * 12 : Number(v.ctc);
  const validationError = validateHireInput({
    firstName: v.firstName,
    lastName: v.lastName,
    personalEmail: v.personalEmail,
    phone: v.phone,
    dob: v.dob,
    doj: v.doj,
    ctc: localCtc,
    workEmail: isEdit ? v.workEmail : workEmail,
  });
  if (validationError) {
    return fail(validationError, /ctc|date of joining is required/i.test(validationError) ? 'job' : 'personal');
  }

  // Tenant placement by the caller's role (same rules as the web).
  const effectiveOrgId = isUuid(sessionOrgId) ? sessionOrgId : undefined;
  let effectiveCompanyId;
  if (isBranchAdmin || isCompanyAdmin) {
    if (isUuid(sessionCompanyId)) effectiveCompanyId = sessionCompanyId;
  } else if (isSuperAdmin) {
    if (v.placementMode === 'company' && isUuid(v.companyId)) effectiveCompanyId = v.companyId;
  }
  let effectiveBranchId;
  if (isBranchAdmin) {
    if (isUuid(sessionBranchId)) effectiveBranchId = sessionBranchId;
  } else if (isCompanyAdmin || isSuperAdmin) {
    if (effectiveCompanyId && isUuid(v.branchId)) effectiveBranchId = v.branchId;
  }

  const deptId = idOrEmpty(v.deptId);
  const designationId = idOrEmpty(v.designationId);
  const managerId = idOrEmpty(v.managerId);
  const hrId = idOrEmpty(v.hrId);
  const shiftId = idOrEmpty(v.shiftId);
  const roleObj = roles.find((r) => r.name === v.roleName);
  const tempPassword = isEdit ? '' : makeTempPassword(s(v.firstName), v.dob);

  const apiFields = {
    first_name: s(v.firstName),
    ...(isEdit ? {} : { password: tempPassword }),
    ...(!isEdit && s(v.employeeCode) ? { employee_code: s(v.employeeCode) } : {}),
    last_name: s(v.lastName),
    work_email: workEmail,
    personal_email: s(v.personalEmail),
    phone: s(v.phone),
    date_of_birth: v.dob || '',
    gender: v.gender || '',
    department: departments.find((d) => String(d.id) === String(deptId))?.name ?? '',
    department_id: isUuid(deptId) ? deptId : undefined,
    designation: designations.find((d) => String(d.id) === String(designationId))?.name ?? '',
    designation_id: isUuid(designationId) ? designationId : undefined,
    role: v.roleName || 'Employee',
    role_id: isUuid(roleObj?.id) ? roleObj.id : undefined,
    hr_partner_id: isUuid(hrId) ? hrId : undefined,
    shift_id: isUuid(shiftId) ? shiftId : undefined,
    employment_type: v.employmentType || 'Full-time',
    manager_id: isUuid(managerId) ? managerId : undefined,
    date_of_joining: v.doj || '',
    probation_months: v.probationMonths || '3',
    ...(isEdit ? {} : { status: 'ACTIVE' }),
    ctc: wageType === 'Monthly' && v.ctc ? String(Number(v.ctc)) : '',
    daily_rate: wageType === 'Daily' && v.dailyRate ? String(Number(v.dailyRate)) : '',
    grade: v.grade || '',
    wage_type: wageType,
    pf_applicable: String(v.pfApplicable),
    esi_applicable: String(v.esiApplicable),
    pf_member_id: s(v.pfMemberId) || undefined,
    pt_state: s(v.ptState) || undefined,
    skill_category: v.skillCategory || undefined,
    father_spouse_name: s(v.fatherSpouse) || undefined,
    place_of_birth: s(v.placeOfBirth) || undefined,
    identification_mark: s(v.identificationMark) || undefined,
    nominee_name: s(v.nominee) || undefined,
    pension_scheme: v.pensionScheme && v.pensionScheme !== PENSION_NONE ? v.pensionScheme : undefined,
    family_details: s(v.familyDetails) || undefined,
    service_book_number: s(v.serviceBook) || undefined,
    notice_period_days: v.noticeDays || undefined,
    work_mode: v.workMode || undefined,
    pan_number: pan || undefined,
    aadhaar_number: aadhaar || undefined,
    uan_number: uan || undefined,
    esic_number: esic || undefined,
    bank_name: s(v.bankName) || undefined,
    bank_account_number: acct || undefined,
    ifsc_code: ifsc || undefined,
    marital_status: v.maritalStatus || undefined,
    blood_group: v.bloodGroup || undefined,
    nationality: v.nationality || undefined,
    religion: v.religion || undefined,
    whatsapp_number: v.whatsapp || undefined,
    emergency_contact_name: v.emergencyName || undefined,
    emergency_contact_phone: v.emergencyPhone || undefined,
    emergency_contact_relationship: s(v.emergencyRelation) || undefined,
    current_address: v.currentAddress || undefined,
    permanent_address: v.permanentAddress || undefined,
    linkedin_url: v.linkedin || undefined,
    github_url: v.github || undefined,
    twitter_url: v.twitter || undefined,
    website_url: v.website || undefined,
    qualification: v.qualification || undefined,
    institution: v.institution || undefined,
    year_of_passing: v.yearOfPassing || undefined,
    education_score: v.eduScore || undefined,
    driving_license_number: v.drivingLicence || undefined,
    passport_number: s(v.passport).toUpperCase() || undefined,
    bank_account_holder_name: v.bankHolder || undefined,
    bank_branch: v.bankBranch || undefined,
    bank_account_type: v.accountType || undefined,
    payment_mode: v.payMode || undefined,
    pay_frequency: v.payFrequency || undefined,
  };

  // Masked values (XXXX1234) come back from the server read-only — never send one back.
  ['pan_number', 'aadhaar_number', 'bank_account_number', 'passport_number', 'uan_number'].forEach((k) => {
    if (isEdit && /^X{4,}/i.test(apiFields[k] ?? '')) delete apiFields[k];
  });

  // Previous employment blocks, renumbered from 1 (blank-company blocks are ignored).
  const prevBlocks = (v.experience ?? [])
    .map((b) => ({
      company: s(b.company),
      role: s(b.role),
      from: s(b.from),
      to: s(b.to),
      ctc: s(b.ctc).replace(/[^\d.]/g, ''),
      reason: s(b.reason),
      files: b.files ?? {},
    }))
    .filter((b) => b.company);
  const hasPrevFiles = (v.experience ?? []).some((b) => Object.keys(b.files ?? {}).length);
  const addPrevBlocks = () => {
    prevBlocks.forEach((b, i) => {
      const idx = i + 1;
      const put = (suffix, val) => val && append(`prev${idx}_${suffix}`, val);
      put('company', b.company);
      put('role', b.role);
      put('from', b.from);
      put('to', b.to);
      put('ctc', b.ctc);
      put('reason', b.reason);
      Object.entries(b.files).forEach(([type, f]) => append(`prev${idx}_${type}`, filePart(f)));
    });
  };

  // Valid UUIDs only; a branch is never sent without its company.
  if (effectiveOrgId) apiFields.organization_id = effectiveOrgId;
  if (effectiveCompanyId) {
    apiFields.company_id = effectiveCompanyId;
    if (effectiveBranchId) apiFields.branch_id = effectiveBranchId;
  }

  const formData = new FormData();
  const keys = new Set();
  const append = (k, val) => {
    formData.append(k, val);
    keys.add(k);
  };

  if (isEdit) {
    const locked = new Set(['work_email', 'organization_id', 'company_id', 'branch_id']);
    const clearable = new Set([
      'last_name', 'personal_email', 'phone', 'date_of_birth', 'gender', 'grade', 'pan_number',
      'aadhaar_number', 'uan_number', 'esic_number', 'pf_member_id', 'pt_state', 'bank_name', 'bank_account_number', 'ifsc_code',
      'marital_status', 'blood_group', 'nationality', 'religion', 'whatsapp_number',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship', 'skill_category',
      'father_spouse_name', 'place_of_birth', 'identification_mark', 'nominee_name', 'pension_scheme', 'family_details',
      'service_book_number', 'current_address', 'permanent_address', 'linkedin_url', 'github_url', 'twitter_url', 'website_url',
      'qualification', 'institution', 'year_of_passing', 'education_score', 'driving_license_number', 'passport_number',
      'bank_account_holder_name', 'bank_branch', 'bank_account_type', 'payment_mode',
      'department', 'department_id', 'designation', 'designation_id',
    ]);
    const edu = employee.education?.[0] ?? {};
    const eduPrev = {
      qualification: edu.qualification,
      institution: edu.institution,
      year_of_passing: edu.year_of_passing,
      education_score: edu.score,
    };
    const prevValue = (key) => (key in eduPrev ? eduPrev[key] : employee[key]);

    // The id fields below are handled separately (the string "null" clears them).
    const idKeys = new Set(['manager_id', 'hr_partner_id', 'shift_id']);
    const changes = {};
    Object.keys(apiFields)
      .concat([...clearable].filter((k) => !(k in apiFields)))
      .forEach((key) => {
        if (locked.has(key) || idKeys.has(key)) return;
        const next = s(apiFields[key]);
        const prev = s(prevValue(key));
        if (next === prev) return;
        // "5" and "5.0" are the same amount, but a service book number is text.
        if (key !== 'service_book_number' && next !== '' && prev !== '' && !isNaN(next) && !isNaN(prev) && Number(next) === Number(prev))
          return;
        if (next === '') {
          if (clearable.has(key) && prev !== '') changes[key] = 'null';
          return;
        }
        changes[key] = next;
      });
    // A wage type change needs the amount for the new type in the same request (422 otherwise).
    if ('wage_type' in changes) {
      if (wageType === 'Daily') changes.daily_rate = String(Number(v.dailyRate));
      else changes.ctc = String(Number(v.ctc));
    }
    [
      ['manager_id', managerId],
      ['hr_partner_id', hrId],
      ['shift_id', shiftId],
    ].forEach(([key, val]) => {
      const prev = employee[key] || '';
      if ((val || '') === prev) return;
      changes[key] = isUuid(val) ? val : 'null';
    });
    // Placement (not for a Branch Admin): company cleared → organisation level, branch cleared → company level.
    if (!isBranchAdmin) {
      const prevCompany = employee.company_id || '';
      const prevBranch = employee.branch_id || '';
      const newCompany = effectiveCompanyId || '';
      const newBranch = newCompany ? effectiveBranchId || '' : '';
      if (newCompany !== prevCompany) {
        changes.company_id = newCompany || 'null';
        if (newCompany && newBranch) changes.branch_id = newBranch;
        else if (newCompany && prevBranch) changes.branch_id = 'null';
      } else if (newCompany && newBranch !== prevBranch) {
        changes.branch_id = newBranch || 'null';
      }
    }
    // Pay components: pc_<CODE>=<number>; "null" removes the override.
    Object.entries(v.payComponents ?? {}).forEach(([code, raw]) => {
      const next = s(raw);
      const prev = v.initPayComponents?.[code];
      if (next === '') {
        if (prev !== undefined) changes[`pc_${code}`] = 'null';
      } else if (prev === undefined || Number(next) !== Number(prev)) {
        changes[`pc_${code}`] = next;
      }
    });
    Object.entries(changes).forEach(([k, val]) => append(k, val));
    // Previous employment: any prevN_* key replaces the whole list, so send it only when it changed.
    const sig = (x) => JSON.stringify([s(x.company), s(x.role), s(x.from), s(x.to), s(x.ctc).replace(/[^\d.]/g, ''), s(x.reason)]);
    const initSig = (v.initExperience ?? []).filter((x) => s(x.company)).map(sig);
    const nowSig = prevBlocks.map(sig);
    if (hasPrevFiles || (prevBlocks.length && JSON.stringify(initSig) !== JSON.stringify(nowSig))) addPrevBlocks();
  } else {
    Object.entries(apiFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') append(key, String(value).trim());
    });
    Object.entries(v.payComponents ?? {}).forEach(([code, raw]) => {
      if (s(raw) !== '') append(`pc_${code}`, s(raw));
    });
    addPrevBlocks();
  }

  // Onboarding / bank documents.
  Object.entries(v.docFiles ?? {}).forEach(([name, f]) => {
    if (f?.uri) append(name, filePart(f));
  });

  return { formData, workEmail, tempPassword, noChanges: isEdit && keys.size === 0 };
}

/** Replaces the work_email part of a create body (duplicate-email retry). */
export function withWorkEmail(formData, workEmail) {
  const parts = formData?._parts;
  if (Array.isArray(parts)) {
    const p = parts.find(([k]) => k === 'work_email');
    if (p) p[1] = workEmail;
    else formData.append('work_email', workEmail);
  }
  return formData;
}
