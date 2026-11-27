import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

/** Same endpoints and field mapping as the web app (src/api/resignation_api.js + exit/data/resignation_adapter.js). */
const BASE = '/resignations';

const unwrap = (data: any) => (data?.data != null ? data.data : data);

export type Resignation = {
  id: string;
  code: string;
  reason: string;
  requestedLwd: string;
  note: string;
  letter: { name: string; url: string; type: string } | null;
  submittedAt: string;
  status: string;
  managerName: string;
  managerStatus: string;
  managerRemarks: string;
  hrStatus: string;
  hrRemarks: string;
  noticeDays: number | null;
  noticeStart: string;
  noticeEnd: string;
  finalLwd: string;
};

export const fromApi = (r: any = {}): Resignation => ({
  id: String(r.id ?? ''),
  code: r.resignation_code ?? '',
  reason: r.reason ?? '',
  requestedLwd: r.requested_last_working_day ?? '',
  note: r.resignation_note ?? '',
  letter: r.resignation_letter
    ? { name: r.resignation_letter.file_name ?? '', url: r.resignation_letter.file_url ?? '', type: r.resignation_letter.file_type ?? '' }
    : null,
  submittedAt: r.submitted_at ?? '',
  status: r.status ?? '',
  managerName: r.reporting_manager?.name ?? '',
  managerStatus: r.manager_approval_status ?? '',
  managerRemarks: r.manager_remarks ?? '',
  hrStatus: r.hr_clearance_status ?? '',
  hrRemarks: r.hr_remarks ?? '',
  noticeDays: r.notice_period?.notice_period_days ?? null,
  noticeStart: r.notice_period?.notice_period_start_date ?? '',
  noticeEnd: r.notice_period?.notice_period_end_date ?? '',
  finalLwd: r.final_last_working_day ?? '',
});

export async function getResignationReasons(): Promise<string[]> {
  const d = unwrap((await api.get(`${BASE}/reasons`)).data);
  const items: any[] = Array.isArray(d) ? d : (d?.items ?? d?.results ?? d?.reasons ?? []);
  return items
    .map((o) => (typeof o === 'string' ? o : (o?.value ?? o?.name ?? o?.label ?? o?.reason ?? '')))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/** POST /resignations/apply (multipart). Letter: { uri, name, type } from expo-document-picker. */
export async function applyForResignation({
  reason,
  requestedLwd,
  note,
  letter,
}: {
  reason: string;
  requestedLwd: string;
  note: string;
  letter?: { uri: string; name: string; type: string } | null;
}): Promise<Resignation> {
  const fd = new FormData();
  fd.append('reason', reason.trim());
  fd.append('requested_last_working_day', requestedLwd);
  fd.append('resignation_note', note.trim());
  if (letter) fd.append('resignation_letter', letter as any);
  const { data } = await api.post(`${BASE}/apply`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return fromApi(unwrap(data));
}

export async function getResignation(id: string): Promise<Resignation> {
  return fromApi(unwrap((await api.get(`${BASE}/${id}`)).data));
}

// The API has no "my resignation" list endpoint, so (like the web) the id returned by apply is remembered on the device.
const KEY = 'hrms.myResignationId';
export async function rememberResignationId(id: string) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, id);
  else await SecureStore.setItemAsync(KEY, id);
}
export async function recalledResignationId(): Promise<string> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? '';
  return (await SecureStore.getItemAsync(KEY)) ?? '';
}
