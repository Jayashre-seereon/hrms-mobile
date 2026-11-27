import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { downloadAndShareMyPayslip, employeeIdOf, money } from '@/api/payslips';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/store/session';
import { Button, Card, Muted, Row } from '@/ui/components';
import { Header, Page } from '@/ui/kit';
/** One payslip month: summary + download the PDF (GET /me/payslips/download) and share/open it. */
export default function PayslipDetailScreen() {
  const { id, label, net } = useLocalSearchParams();
  const employeeId = employeeIdOf(useSession((s) => s.me));
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await downloadAndShareMyPayslip(String(id), employeeId);
    } catch (e) {
      Alert.alert('Payslip', errorMessage(e, 'Could not download the salary slip.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <Header title={label || String(id)} />
      <Card style={{ gap: 0 }}>
        <Row label="Month" value={label || id} />
        <Row label="Net pay" value={net ? money(net) : undefined} />
      </Card>
      <Muted>The full earnings and deductions breakdown is in the PDF payslip.</Muted>
      <Button title="Download / share PDF" onPress={download} loading={busy} />
    </Page>
  );
}
