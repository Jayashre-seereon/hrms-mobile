import { AxiosError } from 'axios';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api';
import { useSession } from '@/store/session';
import { Button, Card, ErrorText, Field, Muted, Screen } from '@/ui/components';
import { useColors } from '@/ui/theme';

export default function LoginScreen() {
  const c = useColors();
  const signIn = useSession((s) => s.signIn);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const id = identifier.trim();
    if (!id || !password) {
      setError('Enter your email or employee ID and your password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(id, password);
      // The root layout switches to the app (or the change-password screen) automatically.
    } catch (err) {
      const e = err as AxiosError<{ locked_until?: string; retry_after?: number }>;
      const status = e.response?.status;
      if (status === 423) {
        const until = e.response?.data?.locked_until;
        setError(`Account locked${until ? ` until ${new Date(until).toLocaleTimeString()}` : ''}.`);
      } else if (status === 429) {
        setError('Too many attempts. Please wait and try again.');
      } else {
        setError(errorMessage(err, 'Sign in failed. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ marginTop: 48, marginBottom: 8, gap: 6 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: c.primary }}>HRMS</Text>
          <Muted>Sign in with your work account</Muted>
        </View>
        <Card style={{ gap: 16 }}>
          <Field
            label="Email or Employee ID"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder="you@company.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" onPress={submit} loading={busy} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
