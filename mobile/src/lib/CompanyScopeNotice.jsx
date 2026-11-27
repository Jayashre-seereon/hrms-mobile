import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useScope } from '@/lib/access';
import { useSession } from '@/store/session';
import { Button, Card, Muted } from '@/ui/components';
import { useColors } from '@/ui/theme';
/** Set while the picker screen is open, so several mounted screens do not push it twice. */
let pickerOpen = false;
export const setPickerOpen = (v) => {
  pickerOpen = v;
};
export const COMPANY_PICKER = '/company-picker';
/** Opens the company picker by itself when the API answered 400 "Select a company" (web: GlobalCompanyPicker). */
export function useCompanyPickerAutoOpen() {
  const router = useRouter();
  const needCompany = useSession((s) => s.needCompany);
  const { isSuperAdmin } = useScope();
  useEffect(() => {
    if (needCompany && isSuperAdmin && !pickerOpen) {
      pickerOpen = true;
      router.push(COMPANY_PICKER);
    }
  }, [needCompany, isSuperAdmin, router]);
}
/**
 * Super Admin only: on company-scoped screens, asks to pick a company when none is picked.
 * Renders nothing for everyone else, or when a company is already picked.
 */
export function CompanyScopeNotice({ message }) {
  const router = useRouter();
  const { needsCompany } = useScope();
  useCompanyPickerAutoOpen();
  if (!needsCompany) return null;
  return (
    <Card>
      <Muted>
        {message ??
          'Employees, roles, master data, attendance and payroll belong to one company. Pick the one you want to work in.'}
      </Muted>
      <Button title="Choose a company" onPress={() => router.push(COMPANY_PICKER)} />
    </Card>
  );
}
/** Super Admin only: "Working in: <company>" strip with a Change button (web: CompanySwitcher + CompanyBanner). */
export function CompanySwitcherRow() {
  const c = useColors();
  const router = useRouter();
  const { isSuperAdmin, companyId, companyName } = useScope();
  useCompanyPickerAutoOpen();
  if (!isSuperAdmin) return null;
  return (
    <Pressable onPress={() => router.push(COMPANY_PICKER)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="business-outline" size={22} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Muted style={{ fontSize: 12 }}>{companyId ? 'Working in' : 'No company selected'}</Muted>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
            {companyId ? companyName || 'This company' : 'Select company'}
          </Text>
        </View>
        <Text style={{ color: c.primary, fontWeight: '600' }}>{companyId ? 'Change' : 'Select'}</Text>
      </Card>
    </Pressable>
  );
}
