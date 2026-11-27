import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from './theme';

export function Screen({
  children,
  scroll = true,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screen} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const c = useColors();
  return <Text style={[{ color: c.muted, fontSize: 14 }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : 'transparent';
  const fg = variant === 'outline' ? c.text : c.primaryText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'outline' ? c.border : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[
          styles.input,
          props.multiline && { height: undefined, minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
          { color: c.text, borderColor: error ? c.danger : c.border, backgroundColor: c.card },
        ]}
      />
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children?: string }) {
  const c = useColors();
  if (!children) return null;
  return <Text style={{ color: c.danger, fontSize: 14 }}>{children}</Text>;
}

export function Row({ label, value }: { label: string; value?: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: c.border }]}>
      <Text style={{ color: c.muted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' }}>
        {value === undefined || value === null || value === '' ? '—' : value}
      </Text>
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  button: { height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
