import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { personName } from '@/api/admin/common';
import { getEmployeeById, getEmployeeDocuments } from '@/api/admin/employees';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Loading, Muted, Row } from '@/ui/components';
import { fmtDate, initials } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>{title}</Text>
      <Card style={{ gap: 0 }}>{children}</Card>
    </>
  );
}

/** Read-only employee record (web: EmployeeDetail.jsx). Editing stays on the web portal. */
export default function EmployeeDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['admin', 'employee', id], queryFn: () => getEmployeeById(String(id)), enabled: !!id });
  const docs = useQuery({ queryKey: ['admin', 'employee', id, 'documents'], queryFn: () => getEmployeeDocuments(String(id)), enabled: !!id });

  const e: Record<string, any> = q.data ?? {};
  const name = personName(e) || 'Employee';

  return (
    <Page
      onRefresh={() => {
        q.refetch();
        docs.refetch();
      }}
      refreshing={q.isRefetching}>
      <Header title={q.data ? name : 'Employee'} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorText>{errorMessage(q.error, 'Could not load the employee.')}</ErrorText>
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{initials(name)}</Text>
            </View>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{name}</Text>
            <Muted>{[e.designation, e.employee_code].filter(Boolean).join(' · ')}</Muted>
            <Badge label={e.status || 'Active'} />
          </View>

          <Section title="Job">
            <Row label="Department" value={e.department} />
            <Row label="Designation" value={e.designation} />
            <Row label="Branch" value={e.branch_name || e.branch} />
            <Row label="Company" value={e.company_name} />
            <Row label="Employment type" value={e.employment_type} />
            <Row label="Grade" value={e.grade} />
            <Row label="Date of joining" value={e.date_of_joining ? fmtDate(e.date_of_joining) : null} />
            <Row label="Probation (months)" value={e.probation_months != null ? String(e.probation_months) : null} />
          </Section>

          <Section title="Contact">
            <Row label="Work email" value={e.work_email || e.email} />
            <Row label="Personal email" value={e.personal_email} />
            <Row label="Phone" value={e.phone} />
            <Row label="WhatsApp" value={e.whatsapp_number} />
            <Row
              label="Emergency contact"
              value={[e.emergency_contact_name, e.emergency_contact_relationship, e.emergency_contact_phone].filter(Boolean).join(' · ')}
            />
            <Row label="Current address" value={e.current_address} />
          </Section>

          <Section title="Personal">
            <Row label="Date of birth" value={e.date_of_birth ? fmtDate(e.date_of_birth) : null} />
            <Row label="Gender" value={e.gender} />
            <Row label="Marital status" value={e.marital_status} />
            <Row label="Blood group" value={e.blood_group} />
            <Row label="Nationality" value={e.nationality} />
          </Section>

          <Section title="Documents">
            {docs.isLoading ? (
              <Loading />
            ) : !docs.data?.length ? (
              <Muted style={{ paddingVertical: 10 }}>No documents uploaded.</Muted>
            ) : (
              docs.data.map((d: any, i: number) => (
                <Row
                  key={d.id ?? `${d.document_type}-${i}`}
                  label={String(d.document_type ?? d.name ?? 'Document').replace(/_/g, ' ')}
                  value={
                    d.view_url && /^https?:\/\//i.test(d.view_url) ? (
                      <Text style={{ color: c.primary }} onPress={() => Linking.openURL(d.view_url)}>
                        Open
                      </Text>
                    ) : (
                      'Uploaded'
                    )
                  }
                />
              ))
            )}
          </Section>
          <Muted style={{ textAlign: 'center' }}>Edit employee details on the web portal.</Muted>
        </>
      )}
    </Page>
  );
}
