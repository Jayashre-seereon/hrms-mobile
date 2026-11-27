// Bulk upload employees — mobile version of the web BulkEmployeeImportDialog.
// Validate first (dry run, nothing saved), then import; chunks of 250 rows are sent one after another, a dropped
// call is retried (on_duplicate "skip" makes that safe), and the run can be stopped and resumed.
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  BULK_CHUNK_SIZE,
  apiErrorText,
  canBulkImportEmployees,
  chunkRecords,
  downloadErrorReport,
  downloadFailedRows,
  downloadImportTemplate,
  employeeBulkApi,
  isRetryable,
  loadBatches,
  newBatchId,
  orderForManagers,
  parseImportFile,
  saveBatch,
  updateBatch,
} from '@/api/admin/employees-import';
import { useAccess, useScope } from '@/lib/access';
import { CompanyScopeNotice } from '@/lib/CompanyScopeNotice';
import { useSession } from '@/store/session';
import { Button, Card, ErrorText, Muted } from '@/ui/components';
import { Header, Page } from '@/ui/kit';
import { useColors } from '@/ui/theme';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const num = (n) => Number(n ?? 0).toLocaleString('en-IN');
const when = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });


/** Same file types as the web input (accept=".csv,.xlsx"); Android reports CSV under several MIME types. */
const PICK_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
];

function Stat({ value, label, color }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: color ?? c.text }}>{num(value)}</Text>
      <Muted style={{ fontSize: 12, textAlign: 'center' }}>{label}</Muted>
    </View>
  );
}

function Notice({ tone = 'warning', children }) {
  const c = useColors();
  const color = tone === 'info' ? c.primary : tone === 'success' ? c.success : c.warning;
  return (
    <View style={{ borderWidth: 1, borderColor: color, borderRadius: 10, padding: 10 }}>
      <Text style={{ color, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

function ProgressBar({ value }) {
  const c = useColors();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: 8, backgroundColor: c.primary }} />
    </View>
  );
}

export default function EmployeeImportScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { role, can } = useAccess();
  const { needsCompany } = useScope();
  const companyName = useSession((s) => s.scopeCompanyName || s.me?.company?.name || '');
  const orgMode = needsCompany; // Super Admin with no company picked (web: useOrgMode)
  const canManagePeople = canBulkImportEmployees(role, can);

  const batchIdRef = useRef(newBatchId());
  const cancelRef = useRef(false);

  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | running | paused | done
  const [run, setRun] = useState(null); // { mode, chunk, chunks, rowsDone, rowsTotal }
  const [report, setReport] = useState(null); // { mode, created, skipped, failed, items, ignored }
  const [resume, setResume] = useState(null); // { mode, index, message, agg }
  const [batches, setBatches] = useState([]);
  const [creds, setCreds] = useState({}); // batch_id -> { loading, result, error }
  const [templateBusy, setTemplateBusy] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const busy = phase === 'running';

  useEffect(() => {
    loadBatches().then(setBatches);
  }, []);

  // Rows with a problem the phone can already see never go to the server; the rest are ordered and chunked.
  const plan = useMemo(() => {
    if (!parsed) return null;
    const bad = parsed.records.filter((r) => r.clientErrors.length);
    const ready = parsed.records.filter((r) => !r.clientErrors.length);
    return { bad, ready, chunks: chunkRecords(orderForManagers(ready)) };
  }, [parsed]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setParseError('');
    setPhase('idle');
    setRun(null);
    setReport(null);
    setResume(null);
    setShowSkipped(false);
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES, copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return;
    const chosen = res.assets[0];
    reset();
    setFile(chosen);
    batchIdRef.current = newBatchId(); // a new file is a new run
    try {
      setParsed(await parseImportFile(chosen));
    } catch (e) {
      setParseError(e?.message || 'Could not read this file.');
    }
  };

  const sendChunk = async (chunk, dry) => {
    const body = {
      batch_id: batchIdRef.current,
      dry_run: dry,
      on_duplicate: 'skip', // makes sending a chunk again safe
      send_credentials: false, // credentials are sent later, on purpose
      rows: chunk.map((r) => r.data),
    };
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await employeeBulkApi.importRows(body);
      } catch (e) {
        if (!isRetryable(e) || attempt >= 2) throw e;
        await wait(1500 * (attempt + 1)); // same chunk again; saved rows come back as "skipped"
      }
    }
  };

  const snapshot = (agg, mode) => ({
    mode,
    created: agg.created,
    skipped: agg.skipped,
    failed: agg.failed,
    items: [...agg.items],
    ignored: [...agg.ignored],
  });

  const execute = async (mode, startAt = 0, carried = null) => {
    if (!plan) return;
    const dry = mode === 'validate';
    const agg = carried ?? {
      created: 0,
      skipped: 0,
      failed: plan.bad.length,
      ignored: new Set(),
      items: plan.bad.map((r) => ({
        fileRow: r.fileRow,
        employee_code: r.data.employee_code,
        status: 'failed',
        errors: r.clientErrors,
      })),
    };
    const rowsTotal = plan.ready.length;
    cancelRef.current = false;
    setResume(null);
    setPhase('running');
    setReport(snapshot(agg, mode));

    for (let i = startAt; i < plan.chunks.length; i += 1) {
      if (cancelRef.current) {
        setResume({ mode, index: i, message: 'Stopped. Resume to carry on with the next call.', agg });
        setPhase('paused');
        return;
      }
      const chunk = plan.chunks[i];
      setRun({ mode, chunk: i + 1, chunks: plan.chunks.length, rowsDone: i * BULK_CHUNK_SIZE, rowsTotal });
      let res;
      try {
        res = await sendChunk(chunk, dry);
      } catch (e) {
        setResume({ mode, index: i, message: apiErrorText(e), agg });
        setPhase('paused');
        return;
      }
      for (const r of res.results ?? []) {
        const rec = chunk[r.row - 1];
        agg.items.push({
          fileRow: rec?.fileRow ?? r.row,
          employee_code: r.employee_code ?? rec?.data.employee_code,
          status: r.status,
          work_email: r.work_email,
          errors: r.errors ?? [],
        });
      }
      agg.created += res.created ?? 0;
      agg.skipped += res.skipped ?? 0;
      agg.failed += res.failed ?? 0;
      (res.ignored_columns ?? []).forEach((col) => agg.ignored.add(col));
      setReport(snapshot(agg, mode));
      if (!dry && agg.created > 0) {
        setBatches(
          await saveBatch({
            batch_id: batchIdRef.current,
            file: file?.name ?? '',
            company: companyName,
            at: new Date().toISOString(),
            created: agg.created,
            skipped: agg.skipped,
            failed: agg.failed,
          }),
        );
      }
    }

    setRun({ mode, chunk: plan.chunks.length, chunks: plan.chunks.length, rowsDone: rowsTotal, rowsTotal });
    setPhase('done');
    if (!dry) {
      if (agg.created > 0) {
        Alert.alert('Import finished', `${num(agg.created)} employee${agg.created === 1 ? '' : 's'} imported.`);
        qc.invalidateQueries({ queryKey: ['admin', 'employees'] });
      }
      batchIdRef.current = newBatchId(); // the next import is a new run
    }
  };

  const failedItems = useMemo(
    () => (report?.items ?? []).filter((i) => i.status === 'failed').sort((a, b) => a.fileRow - b.fileRow),
    [report],
  );
  const skippedItems = useMemo(() => (report?.items ?? []).filter((i) => i.status === 'skipped'), [report]);
  const failedRecords = useMemo(() => {
    if (!parsed) return [];
    const rows = new Set(failedItems.map((i) => i.fileRow));
    return parsed.records.filter((r) => rows.has(r.fileRow));
  }, [parsed, failedItems]);

  const doSendCredentials = async (batch) => {
    setCreds((s) => ({ ...s, [batch.batch_id]: { loading: true } }));
    try {
      const result = await employeeBulkApi.sendCredentials(batch.batch_id);
      setCreds((s) => ({ ...s, [batch.batch_id]: { result } }));
      setBatches(await updateBatch(batch.batch_id, { credentialsQueuedAt: new Date().toISOString() }));
    } catch (e) {
      setCreds((s) => ({
        ...s,
        [batch.batch_id]: {
          error:
            e?.response?.status === 404
              ? 'This import was not found on the server.'
              : apiErrorText(e, 'Could not queue the credentials.'),
        },
      }));
    }
  };

  const sendCredentials = (batch) =>
    Alert.alert(
      'Send credentials',
      `Email login details to every employee imported in "${batch.file || 'this import'}"? They can sign in only after this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => doSendCredentials(batch) },
      ],
    );

  const downloadTemplate = async () => {
    setTemplateBusy(true);
    try {
      const missing = await downloadImportTemplate();
      if (missing.length)
        Alert.alert('Template', `Template ready, but these lists could not be loaded: ${missing.join(', ')}.`);
    } catch {
      Alert.alert('Template', 'Could not build the template. Try again.');
    } finally {
      setTemplateBusy(false);
    }
  };

  const share = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('Download', e?.message || 'Could not save the file.');
    }
  };

  if (!canManagePeople) {
    return (
      <Page>
        <Header title="Bulk upload" />
        <Muted>You do not have permission to import employees.</Muted>
      </Page>
    );
  }

  const canRun = Boolean(plan) && !busy && !orgMode && plan.ready.length > 0;
  const isValidation = report?.mode === 'validate';
  const pct = run && run.rowsTotal ? Math.round((run.rowsDone / run.rowsTotal) * 100) : 0;

  return (
    <Page>
      <Header title="Bulk upload employees" />

      <Muted>
        Upload an Excel or CSV file. Check it first with Validate file (nothing is saved), then import.
        {companyName && !orgMode ? ` Importing into ${companyName}.` : ''}
      </Muted>

      {orgMode ? (
        <>
          <Notice>Open a company first. Employees are imported into one company.</Notice>
          <CompanyScopeNotice />
        </>
      ) : null}

      <Card>
        <Button title={templateBusy ? 'Building template…' : 'Download template'} variant="outline" onPress={downloadTemplate} loading={templateBusy} />
        <Muted style={{ fontSize: 12 }}>
          The template lists the department, designation, branch, shift and grade names that exist.
        </Muted>
      </Card>

      <Card>
        <Text style={{ color: c.text, fontWeight: '600' }}>Employee file (Excel .xlsx or CSV)</Text>
        <Button title={file ? 'Choose another file' : 'Choose file'} onPress={pickFile} disabled={busy} variant={file ? 'outline' : 'primary'} />
        {parseError ? <ErrorText>{parseError}</ErrorText> : null}
        {parsed && plan ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.text }}>
              <Text style={{ fontWeight: '600' }}>{file?.name}</Text> · {num(parsed.records.length)} employee
              {parsed.records.length === 1 ? '' : 's'} · {plan.chunks.length} call{plan.chunks.length === 1 ? '' : 's'} of up to{' '}
              {BULK_CHUNK_SIZE}
            </Text>
            {plan.bad.length > 0 ? (
              <Notice>
                {num(plan.bad.length)} row{plan.bad.length === 1 ? '' : 's'} have a problem the file already shows (a repeated
                employee_code or a bank-account mismatch) and will be reported as failed.
              </Notice>
            ) : null}
            {parsed.ignoredColumns.length > 0 ? (
              <Text style={{ color: c.warning, fontSize: 12 }}>
                Columns the server does not use and will ignore: {parsed.ignoredColumns.join(', ')}.
              </Text>
            ) : null}
            {parsed.notSentColumns.length > 0 ? (
              <Muted style={{ fontSize: 12 }}>
                Not sent (the company comes from your login and the work email is generated): {parsed.notSentColumns.join(', ')}.
              </Muted>
            ) : null}
          </View>
        ) : null}
      </Card>

      {parsed ? (
        <View style={{ gap: 10 }}>
          <Button title="Validate file" variant="outline" onPress={() => execute('validate')} disabled={!canRun} />
          <Button
            title={`Import ${plan ? `${num(plan.ready.length)} employees` : 'employees'}`}
            onPress={() => execute('import')}
            disabled={!canRun}
          />
          {busy ? (
            <Button
              title="Stop after this call"
              variant="danger"
              onPress={() => {
                cancelRef.current = true;
              }}
            />
          ) : null}
        </View>
      ) : null}

      {run && (busy || phase === 'paused') ? (
        <Card style={{ gap: 8 }}>
          <Muted>
            {run.mode === 'validate' ? 'Validating' : 'Importing'} · call {run.chunk} of {run.chunks} · {num(run.rowsDone)} of{' '}
            {num(run.rowsTotal)} rows done
          </Muted>
          <ProgressBar value={pct} />
        </Card>
      ) : null}

      {resume ? (
        <Card style={{ gap: 8 }}>
          <ErrorText>{resume.message}</ErrorText>
          <Button
            title={`Resume from call ${resume.index + 1}`}
            onPress={() => execute(resume.mode, resume.index, resume.agg)}
            disabled={busy || orgMode || !plan}
          />
        </Card>
      ) : null}

      {report ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
            {isValidation ? 'Validation result' : 'Import result'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Stat value={report.created} label={isValidation ? 'Would be created' : 'Created'} color={c.success} />
            <Stat value={report.skipped} label="Already exist (skipped)" color={c.muted} />
            <Stat value={report.failed} label="Failed" color={report.failed ? c.danger : c.text} />
          </View>

          {report.ignored.length > 0 ? (
            <Text style={{ color: c.warning, fontSize: 12 }}>The server ignored these columns: {report.ignored.join(', ')}.</Text>
          ) : null}

          {phase === 'done' && isValidation ? (
            <Notice tone="success">
              {report.failed
                ? 'Fix the failed rows in your file, then validate again.'
                : 'No problems found. Nothing was saved. You can import now.'}
            </Notice>
          ) : null}
          {phase === 'done' && !isValidation ? (
            <Notice tone="info">
              Login details have not been sent. Imported employees cannot sign in until you use Send credentials below.
            </Notice>
          ) : null}

          {failedItems.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>Rows that need fixing ({num(failedItems.length)})</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Error report (CSV)" variant="outline" onPress={share(() => downloadErrorReport(failedItems))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Failed rows (Excel)"
                    variant="outline"
                    onPress={share(() => downloadFailedRows(parsed.headers, failedRecords))}
                  />
                </View>
              </View>
              {failedItems.slice(0, 300).map((item) => (
                <Card key={`${item.fileRow}-${item.employee_code}`} style={{ gap: 4, padding: 12 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>
                    Row {item.fileRow} · {item.employee_code ?? '—'}
                  </Text>
                  {(item.errors.length ? item.errors : [{ field: '', msg: 'Not imported' }]).map((e, i) => (
                    <Text key={i} style={{ color: c.danger, fontSize: 13 }}>
                      {e.field ? <Text style={{ fontWeight: '600' }}>{e.field}: </Text> : null}
                      {e.msg}
                    </Text>
                  ))}
                </Card>
              ))}
              {failedItems.length > 300 ? (
                <Muted style={{ fontSize: 12 }}>
                  Showing the first 300. The error report has all {num(failedItems.length)}.
                </Muted>
              ) : null}
              <Muted style={{ fontSize: 12 }}>
                Fix the file and upload it again. Employees already imported are skipped, so nobody is created twice.
              </Muted>
            </View>
          ) : null}

          {skippedItems.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Pressable onPress={() => setShowSkipped((v) => !v)}>
                <Text style={{ color: c.primary, fontSize: 13 }}>
                  {showSkipped ? '▾' : '▸'} {num(skippedItems.length)} row{skippedItems.length === 1 ? '' : 's'} already exist
                  and were left alone
                </Text>
              </Pressable>
              {showSkipped
                ? skippedItems.slice(0, 100).map((i) => (
                    <Muted key={`${i.fileRow}-${i.employee_code}`} style={{ fontSize: 12 }}>
                      Row {i.fileRow} ({i.employee_code ?? '—'}):{' '}
                      {i.errors[0]?.field ? `same ${i.errors[0].field}` : 'already exists'}
                    </Muted>
                  ))
                : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {batches.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Send credentials</Text>
          <Muted style={{ fontSize: 12 }}>
            An import never emails anyone. When you are ready to go live, send each employee their login. Emails go out in
            the background, about 2 per second.
          </Muted>
          {batches.map((b) => {
            const state = creds[b.batch_id] ?? {};
            const result = state.result;
            return (
              <Card key={b.batch_id} style={{ gap: 6, padding: 12 }}>
                <Text style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>
                  {b.file || 'Import'}
                </Text>
                <Muted style={{ fontSize: 12 }}>
                  {[b.company, b.at ? when(b.at) : null, `${num(b.created)} created`].filter(Boolean).join(' · ')}
                  {b.credentialsQueuedAt ? ` · credentials queued ${when(b.credentialsQueuedAt)}` : ''}
                </Muted>
                <Button
                  title={b.credentialsQueuedAt ? 'Send again' : 'Send credentials'}
                  variant="outline"
                  onPress={() => sendCredentials(b)}
                  loading={state.loading}
                  disabled={orgMode}
                />
                {result ? (
                  <View style={{ gap: 2 }}>
                    <Muted style={{ fontSize: 12 }}>
                      Queued {num(result.queued)} · already queued {num(result.already_queued)} · already sent{' '}
                      {num(result.already_sent)}
                    </Muted>
                    {result.no_personal_email > 0 ? (
                      <Text style={{ color: c.warning, fontSize: 12 }}>
                        {num(result.no_personal_email)} employee{result.no_personal_email === 1 ? ' has' : 's have'} no personal
                        email and cannot be mailed. HR must handle them.
                      </Text>
                    ) : null}
                    {result.email_configured === false ? (
                      <Text style={{ color: c.danger, fontSize: 12 }}>
                        The server cannot send email right now (email is not configured).
                      </Text>
                    ) : null}
                    <Muted style={{ fontSize: 12 }}>Emails are being sent in the background.</Muted>
                  </View>
                ) : null}
                {state.error ? <ErrorText>{state.error}</ErrorText> : null}
              </Card>
            );
          })}
        </View>
      ) : null}
    </Page>
  );
}
