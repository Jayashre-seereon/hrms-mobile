import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { tokens } from '@/lib/tokens';

/** Same endpoints as the web app (src/api/payrollRunApi.js → myPayslipMonths / downloadMyPayslip). */
export type PayslipMonth = { month: string; label?: string; net_pay?: number | string; [key: string]: any };

export async function getMyPayslipMonths(employeeId?: string | null): Promise<PayslipMonth[]> {
  try {
    const { data } = await api.get('/me/payslips/months', { params: employeeId ? { employee_id: employeeId } : {} });
    return data?.items ?? data?.months ?? data?.data?.items ?? (Array.isArray(data) ? data : []);
  } catch (e: any) {
    // Some backend versions answer 404 until HR publishes the first payslip.
    if (e?.response?.status === 404) return [];
    throw e;
  }
}

/** Downloads GET /me/payslips/download?month=YYYY-MM as a PDF and opens the share sheet. */
export async function downloadAndShareMyPayslip(month: string, employeeId?: string | null) {
  // A cheap authenticated call first, so an expired access token is refreshed by the api interceptor.
  await api.get('/me');
  const params = new URLSearchParams({ month, ...(employeeId ? { employee_id: String(employeeId) } : {}) });
  const destination = new File(Paths.cache, `payslip-${month}.pdf`);
  const file = await File.downloadFileAsync(`${API_URL}/me/payslips/download?${params.toString()}`, destination, {
    headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}`, Accept: 'application/pdf' },
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Payslip ${month}` });
  }
  return file.uri;
}

export const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
};

export function employeeIdOf(me: any): string | null {
  return me?.employee_id ?? me?.user?.employee_id ?? me?.employee?.id ?? null;
}
