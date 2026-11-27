import { api } from '@/lib/api';
export async function login(identifier, password) {
  // "email" is sent too, like the web app, for backends that still expect the old key.
  const { data } = await api.post('/auth/login', { identifier, email: identifier, password });
  if (!data?.access_token) throw new Error('Login response did not contain the expected tokens.');
  return data;
}
export const getMe = async () => (await api.get('/me')).data;
export const getMyRecord = async (sections) =>
  (await api.get('/me/record', { params: sections?.length ? { sections: sections.join(',') } : undefined })).data;
export const getPasswordPolicy = async () => (await api.get('/auth/password-policy')).data;
export const changeMyPassword = async (body) => (await api.post('/auth/change-password', body)).data;
