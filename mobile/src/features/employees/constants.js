/**
 * Employee Add / Edit form — option lists and field maps copied from the web form
 * (src/features/employees/views/EmployeesView.jsx → AddEmployeeDialog).
 */

export const TABS = [
  { value: 'personal', label: 'Personal' },
  { value: 'previous', label: 'Previous Employment' },
  { value: 'legal', label: 'Legal & Documents' },
  { value: 'bank', label: 'Bank Details' },
  { value: 'job', label: 'Job & Role' },
];

const opts = (list) => list.map((x) => (typeof x === 'string' ? { label: x, value: x } : x));

export const GENDERS = opts(['Female', 'Male', 'Other', 'Prefer not to say']);
export const MARITAL_STATUSES = opts([
  { label: 'Single', value: 'single' },
  { label: 'Married', value: 'married' },
  { label: 'Divorced', value: 'divorced' },
  { label: 'Widowed', value: 'widowed' },
]);
export const BLOOD_GROUPS = opts(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']);
// Same four values the backend accepts for `skill_category`.
export const SKILL_CATEGORIES = opts(['Unskilled', 'Semi-skilled', 'Skilled', 'Highly skilled']);
// "None" stands for empty: never sent on create, clears the value ("null") on edit.
export const PENSION_NONE = 'none';
export const PENSION_SCHEMES = opts([{ label: 'None', value: PENSION_NONE }, 'EPS', 'NPS']);
export const ACCOUNT_TYPES = opts([
  { label: 'Savings', value: 'savings' },
  { label: 'Current', value: 'current' },
  { label: 'Salary', value: 'salary' },
]);
export const PAY_MODES = opts(['NEFT', 'IMPS', 'RTGS', 'UPI', 'Cheque']);
export const EMPLOYMENT_TYPES = opts(['Full-time', 'Part-time', 'Contract', 'Intern']);
export const NOTICE_PERIODS = opts([
  { label: '30 days', value: '30' },
  { label: '60 days', value: '60' },
  { label: '90 days', value: '90' },
]);
export const WORK_MODES = opts([
  { label: 'On-site', value: 'office' },
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
]);
export const WAGE_TYPES = opts(['Monthly', 'Daily']);
export const PROBATION_PERIODS = opts([
  { label: 'None', value: '0' },
  { label: '3 months', value: '3' },
  { label: '6 months', value: '6' },
]);

/** "Nothing chosen" value for optional dropdowns (manager, HR, branch, department, designation). */
export const NONE = '__none__';

/** Onboarding documents (Legal & Documents tab). The passbook upload lives on the Bank tab. */
export const DOCUMENTS = [
  ['aadhaar_card', 'Aadhar Card'],
  ['pan_card', 'PAN Card'],
  ['driving_license', 'Driving License'],
  ['passport', 'Passport'],
  ['resume', 'Resume / CV'],
  ['offer_letter', 'Offer Letter (Signed)'],
  ['appointment_letter', 'Appointment Letter'],
  ['educational_certificate', 'Educational Certificates'],
  ['address_proof', 'Address Proof'],
  ['passport_photo', 'Passport Photo'],
  ['e_signature', 'E-Signature'],
  ['employer_signature', 'Signature of the Employer'],
];
export const PASSBOOK_DOC = ['passbook', 'Cancelled Cheque / Passbook First Page'];

/** Documents of each previous-employment block (sent as prev<N>_<type>). */
export const PREV_DOCUMENTS = [
  ['relieving_letter', 'Relieving Letter'],
  ['experience_letter', 'Experience / Service Letter'],
  ['payslip_1', 'Payslip — Last Month'],
  ['payslip_2', 'Payslip — 2 Months Ago'],
  ['payslip_3', 'Payslip — 3 Months Ago'],
  ['form16', 'Form 16 (Optional)'],
];

export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Form field name -> API field name, so a server error can be shown under the right input.
export const FORM_TO_API = {
  firstName: 'first_name',
  lastName: 'last_name',
  dob: 'date_of_birth',
  gender: 'gender',
  maritalStatus: 'marital_status',
  bloodGroup: 'blood_group',
  nationality: 'nationality',
  religion: 'religion',
  personalEmail: 'personal_email',
  workEmail: 'work_email',
  phone: 'phone',
  employeeCode: 'employee_code',
  whatsapp: 'whatsapp_number',
  emergencyName: 'emergency_contact_name',
  emergencyPhone: 'emergency_contact_phone',
  emergencyRelation: 'emergency_contact_relationship',
  currentAddress: 'current_address',
  permanentAddress: 'permanent_address',
  linkedin: 'linkedin_url',
  github: 'github_url',
  twitter: 'twitter_url',
  website: 'website_url',
  qualification: 'qualification',
  institution: 'institution',
  yearOfPassing: 'year_of_passing',
  eduScore: 'education_score',
  aadhaar: 'aadhaar_number',
  pan: 'pan_number',
  uan: 'uan_number',
  esiNo: 'esic_number',
  drivingLicence: 'driving_license_number',
  passport: 'passport_number',
  bankHolder: 'bank_account_holder_name',
  bankName: 'bank_name',
  accountNo: 'bank_account_number',
  ifsc: 'ifsc_code',
  bankBranch: 'bank_branch',
  accountType: 'bank_account_type',
  payMode: 'payment_mode',
  doj: 'date_of_joining',
  employmentType: 'employment_type',
  noticeDays: 'notice_period_days',
  workMode: 'work_mode',
  probationMonths: 'probation_months',
  wageType: 'wage_type',
  ctc: 'ctc',
  dailyRate: 'daily_rate',
  grade: 'grade',
  pfMemberId: 'pf_member_id',
  ptState: 'pt_state',
  skillCategory: 'skill_category',
  fatherSpouse: 'father_spouse_name',
  placeOfBirth: 'place_of_birth',
  identificationMark: 'identification_mark',
  nominee: 'nominee_name',
  pensionScheme: 'pension_scheme',
  familyDetails: 'family_details',
  serviceBook: 'service_book_number',
  deptId: 'department_id',
  designationId: 'designation_id',
  managerId: 'manager_id',
  hrId: 'hr_partner_id',
  shiftId: 'shift_id',
  companyId: 'company_id',
  branchId: 'branch_id',
};

const PERSONAL_KEYS = new Set([
  'first_name', 'last_name', 'date_of_birth', 'gender', 'marital_status', 'blood_group', 'nationality',
  'religion', 'personal_email', 'work_email', 'phone', 'whatsapp_number', 'emergency_contact_name',
  'emergency_contact_phone', 'emergency_contact_relationship', 'current_address', 'permanent_address', 'linkedin_url',
  'github_url', 'twitter_url', 'website_url', 'father_spouse_name', 'place_of_birth', 'identification_mark',
]);
const LEGAL_KEYS = new Set([
  'pan_number', 'aadhaar_number', 'uan_number', 'esic_number', 'pf_member_id', 'driving_license_number',
  'passport_number', 'nominee_name', 'pension_scheme', 'family_details', 'service_book_number',
  'aadhaar_card', 'pan_card', 'driving_license', 'passport', 'resume', 'offer_letter', 'appointment_letter',
  'educational_certificate', 'address_proof', 'passport_photo', 'e_signature', 'employer_signature',
]);
const EDUCATION_KEYS = new Set(['qualification', 'institution', 'year_of_passing', 'education_score']);

/** Which tab holds an API field — used to jump to the first field the server rejected. */
export function tabOfField(key) {
  if (/^prev\d+_/.test(key) || EDUCATION_KEYS.has(key)) return 'previous';
  if (PERSONAL_KEYS.has(key)) return 'personal';
  if (LEGAL_KEYS.has(key)) return 'legal';
  if (/^bank_|^ifsc_code$|^payment_mode$|^passbook$/.test(key)) return 'bank';
  return 'job';
}

export const isUuid = (x) =>
  typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

export const staffLabel = (e) =>
  `${[e.first_name, e.last_name].filter(Boolean).join(' ') || e.work_email}${e.designation ? ` — ${e.designation}` : ''}`;
