import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { personName } from '@/api/admin/common';
import { getEmployeeById, getEmployeeDocuments } from '@/api/admin/employees';
import EmployeeDocuments from '@/features/employees/EmployeeDocuments';
import FormXiiiButton from '@/features/employees/FormXiiiButton';
import { errorMessage } from '@/lib/api';
import { useAccess } from '@/lib/access';
import { Card, ErrorText, Loading, Muted, Row } from '@/ui/components';
import { fmtDate, initials } from '@/ui/format';
import { Badge, Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';
function Section({ title, children }) {
  const c = useColors();
  return (
    <>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>{title}</Text>
      <Card style={{ gap: 0 }}>{children}</Card>
    </>
  );
}
/** Small list for the education / previous-employment tables (web: DataTable). */
function ListRows({ rows, empty, render }) {
  if (!Array.isArray(rows) || !rows.length) return <Muted style={{ paddingVertical: 10 }}>{empty}</Muted>;
  return rows.map((r, i) => {
    const [title, sub] = render(r);
    return <Row key={r.id ?? i} label={title || '—'} value={sub} />;
  });
}
const WORK_MODE = { office: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };
const dt = (v) => (v ? fmtDate(v) : null);
/**
 * Employee record (web: EmployeeDetail.jsx). Shows the API-backed sections of the web tabs
 * (Profile, Job & Org, Statutory & Banking, Documents), the document register with upload / replace,
 * and the Form XIII download. "Edit" opens the same edit form as the web (PATCH /employees/{id}/form).
 */
export default function EmployeeDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role, isAdmin, can } = useAccess();
  const canEdit = role !== 'EMPLOYEE' && (isAdmin || can('employee.edit'));
  const q = useQuery({
    queryKey: ['admin', 'employee', id],
    queryFn: () => getEmployeeById(String(id)),
    enabled: !!id,
  });
  const docs = useQuery({
    queryKey: ['admin', 'employee', id, 'documents'],
    queryFn: () => getEmployeeDocuments(String(id)),
    enabled: !!id,
  });
  const e = q.data ?? {};
  const name = personName(e) || 'Employee';
  const probation = e.probation_months != null && e.probation_months !== '' ? `${e.probation_months} months` : null;
  return (
    <Page
      onRefresh={() => {
        q.refetch();
        docs.refetch();
      }}
      refreshing={q.isRefetching}>
      <Header
        title={q.data ? name : 'Employee'}
        right={
          canEdit && q.data
            ? () => (
                <Pressable onPress={() => router.push(`/admin/employees/edit?id=${encodeURIComponent(String(id))}`)} hitSlop={8}>
                  <Text style={{ color: c.primary, fontWeight: '600', fontSize: 16 }}>Edit</Text>
                </Pressable>
              )
            : undefined
        }
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorText>{errorMessage(q.error, 'Could not load the employee.')}</ErrorText>
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: c.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{initials(name)}</Text>
            </View>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{name}</Text>
            <Muted>{[e.designation, e.employee_code].filter(Boolean).join(' · ')}</Muted>
            <Badge label={e.status || 'Active'} />
            <FormXiiiButton employee={{ ...e, id: e.id ?? String(id) }} label="Download Form XIII" />
          </View>

          <Section title="Personal Information">
            <Row label="Date of birth" value={dt(e.date_of_birth)} />
            <Row label="Gender" value={e.gender} />
            <Row label="Personal email" value={e.personal_email} />
            <Row label="Work email" value={e.work_email || e.email} />
            <Row label="Phone" value={e.phone} />
            <Row label="Marital status" value={e.marital_status} />
            <Row label="Blood group" value={e.blood_group} />
            <Row label="Nationality" value={e.nationality} />
            <Row label="Religion" value={e.religion} />
            <Row label="Father / Mother / Spouse" value={e.father_spouse_name} />
            <Row label="Place of birth" value={e.place_of_birth} />
            <Row label="Identification mark" value={e.identification_mark} />
            <Row label="WhatsApp" value={e.whatsapp_number} />
            <Row
              label="Emergency contact"
              value={[e.emergency_contact_name, e.emergency_contact_relationship, e.emergency_contact_phone]
                .filter(Boolean)
                .join(' · ')}
            />
            <Row label="Current address" value={e.current_address} />
            <Row label="Permanent address" value={e.permanent_address} />
            <Row label="LinkedIn" value={e.linkedin_url} />
            <Row label="GitHub" value={e.github_url} />
            <Row label="Twitter / X" value={e.twitter_url} />
            <Row label="Website" value={e.website_url} />
          </Section>

          <Section title="Education">
            <ListRows
              rows={e.education}
              empty="No education on record."
              render={(x) => [x.qualification, [x.institution, x.year_of_passing, x.score].filter(Boolean).join(' · ')]}
            />
          </Section>

          <Section title="Previous Experience">
            <ListRows
              rows={e.previous_employments}
              empty="No previous employment on record."
              render={(x) => [
                x.company_name,
                [x.designation, [x.from_month, x.to_month].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
              ]}
            />
          </Section>

          <Section title="Employment Details">
            <Row label="Employee code" value={e.employee_code} />
            <Row label="Company" value={e.company_name} />
            <Row label="Branch / Office" value={e.branch_name || e.branch} />
            <Row label="Placement level" value={e.placement_level} />
            <Row label="Department" value={e.department} />
            <Row label="Designation" value={e.designation} />
            <Row label="Date of joining" value={dt(e.date_of_joining)} />
            <Row label="Employment type" value={e.employment_type} />
            <Row label="Role (access)" value={e.role} />
            <Row label="Reporting manager" value={e.manager_name} />
            <Row label="HR" value={e.hr_partner_name} />
            <Row label="Shift" value={e.shift_name} />
            <Row label="Work location" value={WORK_MODE[e.work_mode] || e.work_mode} />
            <Row label="Notice period" value={e.notice_period_days != null ? `${e.notice_period_days} days` : null} />
            <Row label="Probation" value={probation} />
            <Row label="Salary grade" value={e.grade} />
            <Row label="Wage type" value={e.wage_type} />
            <Row label="Skill category" value={e.skill_category} />
            <Row label="Status" value={e.status || 'Active'} />
          </Section>

          <Section title="Statutory & Banking">
            <Row label="PAN" value={e.pan_number} />
            <Row label="Aadhaar" value={e.aadhaar_number ? `XXXX XXXX ${String(e.aadhaar_number).slice(-4)}` : null} />
            <Row label="UAN" value={e.uan_number} />
            <Row label="ESIC" value={e.esic_number} />
            <Row label="Pension scheme" value={e.pension_scheme} />
            <Row label="Nominee" value={e.nominee_name} />
            <Row label="Family details" value={e.family_details} />
            <Row label="Service book no." value={e.service_book_number} />
            <Row label="Driving license no." value={e.driving_license_number} />
            <Row label="Passport no." value={e.passport_number} />
            <Row label="Account holder" value={e.bank_account_holder_name} />
            <Row label="Bank" value={e.bank_name} />
            <Row label="Account number" value={e.bank_account_number} />
            <Row label="IFSC" value={e.ifsc_code} />
            <Row label="Bank branch" value={e.bank_branch} />
            <Row label="Account type" value={e.bank_account_type} />
            <Row label="Payment mode" value={e.payment_mode} />
            <Row label="Pay frequency" value={e.pay_frequency} />
          </Section>

          <EmployeeDocuments
            employeeId={String(id)}
            employee={e}
            documents={docs.data ?? []}
            loading={docs.isLoading}
            canEdit={canEdit}
          />
        </>
      )}
    </Page>
  );
}
