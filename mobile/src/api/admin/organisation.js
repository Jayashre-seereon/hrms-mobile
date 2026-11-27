import { api } from '@/lib/api';
import { unwrap } from './common';
/**
 * Root organisation profile + uploads — same endpoints / bodies as the web src/api/organizationApi.js and
 * src/api/uploadApi.js (used by /org/organisation-setup and the company dialog's documents tab).
 */
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
/** RN FormData file part from an expo-document-picker / image-picker asset. */
const filePart = (f) => ({
  uri: f.uri,
  name: f.name || f.fileName || 'upload',
  type: f.mimeType || f.type || 'application/octet-stream',
});
const urlOf = (body) => {
  const d = unwrap(body);
  return d?.url || d;
};

/** GET /organisation → profile with { stats: { total_companies, total_branches, total_employees } } */
export async function getOrganisation() {
  return unwrap((await api.get('/organisation')).data) ?? {};
}
/** PUT /organisation, falling back to POST /organisation/setup on 404 / 405 (web saveOrganization). */
export async function saveOrganisation(payload) {
  let res;
  try {
    res = await api.put('/organisation', payload);
  } catch (err) {
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      res = await api.post('/organisation/setup', payload);
    } else {
      throw err;
    }
  }
  return unwrap(res.data);
}
/** POST /super-admin/upload (multipart: file + folder) → public URL. */
export async function uploadFile(file, folder = 'companies') {
  const fd = new FormData();
  fd.append('file', filePart(file));
  fd.append('folder', folder);
  return urlOf((await api.post('/super-admin/upload', fd, multipart)).data);
}
/** POST /organisation/upload-logo (multipart: file) → URL; the server also stores it as the organisation logo. */
export async function uploadOrgLogo(file) {
  const fd = new FormData();
  fd.append('file', filePart(file));
  return urlOf((await api.post('/organisation/upload-logo', fd, multipart)).data);
}
/** Web OrganisationSetupView payload (both the snake_case and legacy keys, exactly as the web sends them). */
export function organisationPayload(v, me) {
  const t = (x) => String(x ?? '').trim();
  const legal = t(v.legalName) || t(v.name);
  return {
    name: t(v.name),
    legal_name: legal,
    legalName: legal,
    contact_email: t(v.email),
    official_email: t(v.email),
    email: t(v.email),
    contact_phone: t(v.phone),
    phone: t(v.phone),
    website: t(v.website),
    logo_url: v.logoUrl,
    gst_no: t(v.gstin),
    gstin: t(v.gstin),
    pan_no: t(v.pan),
    pan: t(v.pan),
    address: t(v.address),
    city: t(v.city),
    state: t(v.state),
    pincode: t(v.pincode),
    country: t(v.country),
    contact: {
      name: me?.name || me?.full_name || me?.user?.full_name || 'Administrator',
      email: t(v.email),
      phone: t(v.phone),
    },
  };
}
