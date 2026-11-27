import { useState } from 'react';

import { changeMyPassword } from '@/api/auth';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/store/session';
import { Button, Card, ErrorText, Field, Muted, Screen, Title } from '@/ui/components';

/** Shown after login when the account has a temporary / admin-reset password (same rule as the web app). */
export default function ChangePasswordScreen() {
  const passwordChanged = useSession((s) => s.passwordChanged);
  const signOut = useSession((s) => s.signOut);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!current || !next || !confirm) return setError('Fill in all three fields.');
    if (next !== confirm) return setError('New password and confirmation do not match.');
    setBusy(true);
    setError('');
    try {
      const res = await changeMyPassword({ current_password: current, new_password: next, confirm_password: confirm });
      await passwordChanged(res);
    } catch (err) {
      setError(errorMessage(err, 'Could not change the password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Set a new password</Title>
      <Muted>You signed in with a temporary password. Choose a new one to continue.</Muted>
      <Card style={{ gap: 16 }}>
        <Field label="Current (temporary) password" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <ErrorText>{error}</ErrorText>
        <Button title="Save password" onPress={submit} loading={busy} />
        <Button title="Sign out" variant="outline" onPress={signOut} />
      </Card>
    </Screen>
  );
}
