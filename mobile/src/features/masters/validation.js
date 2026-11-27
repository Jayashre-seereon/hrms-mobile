/**
 * Same name rule as the web (src/lib/name-validation.js) used by Department, Leave type and Holiday forms:
 * starts with a capital letter, no numbers, letters / spaces / . ' ’ - & ( ) / , only.
 * Empty returns "" — "required" is checked separately.
 */
const NAME_PATTERN = /^\p{Lu}[\p{L}\s.'’&()/,-]*$/u;
export function nameError(value, label = 'Name') {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!/^\p{Lu}/u.test(text)) return `${label} must start with a capital letter.`;
  if (/\d/.test(text)) return `${label} cannot contain numbers.`;
  if (!NAME_PATTERN.test(text))
    return `${label} contains characters that are not allowed (use letters, spaces and . ' - & ( ) / , only).`;
  return '';
}
export const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
