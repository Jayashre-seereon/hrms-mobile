/**
 * Ports of the web helpers the employee form uses:
 * - src/lib/name-validation.js (nameError)
 * - src/features/recruitment/data/hiring-data.js (validateHireInput)
 * - src/features/employees/data/workEmail.js (work email generation / duplicate detection)
 */

const NAME_PATTERN = /^\p{Lu}[\p{L}\s.'’&()/,-]*$/u;

/** Error message for an invalid name, or "" when valid (empty is checked separately). */
export function nameError(value, label = 'Name') {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!/^\p{Lu}/u.test(text)) return `${label} must start with a capital letter.`;
  if (/\d/.test(text)) return `${label} cannot contain numbers.`;
  if (!NAME_PATTERN.test(text))
    return `${label} contains characters that are not allowed (use letters, spaces and . ' - & ( ) / , only).`;
  return '';
}

/**
 * Same checks as the web's validateHireInput. (The web also checks a local list of issued work emails;
 * on mobile the backend's duplicate-email answer is handled instead.)
 */
export function validateHireInput(input) {
  if (!input.firstName.trim()) return 'First name is required.';
  const firstNameProblem = nameError(input.firstName, 'First name');
  if (firstNameProblem) return firstNameProblem;
  const lastNameProblem = nameError(input.lastName, 'Last name');
  if (lastNameProblem) return lastNameProblem;
  if (input.personalEmail?.trim() && !/^\S+@\S+\.\S+$/.test(input.personalEmail.trim()))
    return 'Personal e-mail is not valid.';
  if (input.workEmail?.trim() && !/^\S+@\S+\.\S+$/.test(input.workEmail.trim())) return 'Work e-mail is not valid.';
  if (input.phone?.trim() && input.phone.replace(/\D/g, '').length < 10)
    return 'Mobile number must have at least 10 digits.';
  if (!input.doj || Number.isNaN(Date.parse(input.doj))) return 'Date of joining is required.';
  if (input.dob) {
    const dob = new Date(`${input.dob}T00:00:00`);
    const doj = new Date(`${input.doj}T00:00:00`);
    if (Number.isNaN(+dob) || dob >= doj) return 'Date of birth must be before the date of joining.';
    const age = (+doj - +dob) / (365.25 * 86_400_000);
    if (age < 18) return 'The employee must be at least 18 years old on the date of joining.';
  }
  if (!(input.ctc > 0)) return 'Annual CTC must be greater than zero.';
  return null;
}

const cleanPart = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const WORK_EMAIL_PREFIX_RE = /^@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

/** The company's work email domain ("@acme.co.in") when set and valid, else "". */
export function normalizeWorkEmailPrefix(prefix) {
  const v = String(prefix ?? '').trim().toLowerCase();
  return WORK_EMAIL_PREFIX_RE.test(v) ? v : '';
}

/**
 * Proposed work email (same rules as the web):
 * company prefix set → first-last@domain; otherwise first.last.org@gmail.com (6–30 chars before "@").
 * `attempt` > 0 appends 2, 3, … so a taken address can be retried.
 */
export function generateWorkEmail({ first, last, org, domain, attempt = 0 }) {
  let f = cleanPart(first);
  if (!f) return '';
  const companyDomain = normalizeWorkEmailPrefix(domain);
  if (companyDomain) {
    const suffix = attempt > 0 ? String(attempt + 1) : '';
    const local = [f, cleanPart(last)].filter(Boolean).join('-').slice(0, 64 - suffix.length);
    return `${local}${suffix}${companyDomain}`;
  }
  let l = cleanPart(last);
  let o = cleanPart(String(org ?? '').trim().split(/\s+/)[0]);
  const suffix = attempt > 0 ? String(attempt + 1) : '';
  const max = 30 - suffix.length;
  const join = () => [f, l, o].filter(Boolean).join('.');
  while (join().length > max) {
    if (o.length > 3) o = o.slice(0, -1);
    else if (l.length > 1) l = l.slice(0, -1);
    else if (f.length > 1) f = f.slice(0, -1);
    else break;
  }
  let local = join();
  if (local.length < 6) local = `${local}.emp`.slice(0, max);
  return `${local}${suffix}@gmail.com`;
}

/** True when the backend rejected the create only because this work email is already registered. */
export function isDuplicateWorkEmail(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status !== 409 && status !== 422) return false;
  if (Array.isArray(detail)) {
    return detail.some(
      (d) =>
        (d.loc ?? []).includes('work_email') &&
        (status === 409 || /exist|taken|already|duplicate|registered/i.test(d.msg ?? '')),
    );
  }
  return status === 409 && /e-?mail/i.test(String(detail ?? ''));
}

/**
 * First-login password: first four letters of the first name + date of birth as DDMMYY
 * (Suryakant, 2003-03-29 → "Sury290303").
 */
export function makeTempPassword(firstName, dob) {
  const letters = (firstName ?? '').replace(/[^\p{L}]/gu, '').slice(0, 4);
  const [yyyy, mm, dd] = String(dob ?? '').split('-');
  return `${letters}${dd ?? ''}${mm ?? ''}${(yyyy ?? '').slice(-2)}`;
}
