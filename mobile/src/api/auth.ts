import { api } from '@/lib/api';

/** Same endpoints as the web app (src/api/SuperAdmin_auth.js and src/api/meApi.js). */

export type LoginResponse = {
  access_token: string;
  refresh_token?: string;
  must_change_password?: boolean;
  redirect_portal?: string;
  user?: { full_name?: string; name?: string; email?: string; role?: string; must_change_password?: boolean };
  [key: string]: unknown;
};

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  // "email" is sent too, like the web app, for backends that still expect the old key.
  const { data } = await api.post('/auth/login', { identifier, email: identifier, password });
  if (!data?.access_token) throw new Error('Login response did not contain the expected tokens.');
  return data;
}

export type Me = Record<string, any>;

export const getMe = async (): Promise<Me> => (await api.get('/me')).data;

export const getMyRecord = async (sections?: string[]) =>
  (await api.get('/me/record', { params: sections?.length ? { sections: sections.join(',') } : undefined })).data;

export const getPasswordPolicy = async () => (await api.get('/auth/password-policy')).data;

export const changeMyPassword = async (body: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}) =>
  (await api.post('/auth/change-password', body)).data;
