/**
 * Building blocks for module screens (lists, forms, pickers). Use these instead of writing new
 * styles in each screen so every module looks the same.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@/lib/api';
import { Card, ErrorText, Loading, Muted } from './components';
import { useColors } from './theme';
/** Sets the header title of a stack screen. */
export function Header({ title, right }) {
  return <Stack.Screen options={{ title, headerRight: right }} />;
}
/** Scrollable page body for stack screens (the header already handles the top safe area). */
export function Page({ children, onRefresh, refreshing = false }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
/** List screen body for a react-query result: loading, error, empty, pull-to-refresh. */
export function QueryList({ query, renderItem, keyOf, empty = 'Nothing here yet.', header }) {
  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(item, i) => (keyOf ? keyOf(item, i) : String(item?.id ?? i))}
      renderItem={({ item, index }) => renderItem(item, index)}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            query.refetch();
          }}
        />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={
        query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorText>{errorMessage(query.error, 'Could not load the list.')}</ErrorText>
        ) : (
          <Muted>{empty}</Muted>
        )
      }
    />
  );
}
/** Tappable list card: title, subtitle lines, optional badge on the right. */
export function ItemCard({ title, lines = [], badge, onPress, children }) {
  const c = useColors();
  const body = (
    <Card style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <Text style={{ color: c.text, fontWeight: '600', fontSize: 15, flexShrink: 1 }}>{title}</Text>
        {badge}
      </View>
      {lines.filter(Boolean).map((l, i) => (
        <Muted key={i}>{l}</Muted>
      ))}
      {children}
    </Card>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}
const STATUS_TONE = {
  APPROVED: 'success',
  ACTIVE: 'success',
  PAID: 'success',
  COMPLETED: 'success',
  PROCESSED: 'success',
  RESOLVED: 'success',
  CLOSED: 'muted',
  PRESENT: 'success',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  CANCELED: 'danger',
  INACTIVE: 'muted',
  ABSENT: 'danger',
  PENDING: 'warning',
  SUBMITTED: 'warning',
  OPEN: 'warning',
  DRAFT: 'muted',
  IN_PROGRESS: 'warning',
};
/** Coloured status pill. Pass the raw status from the API; colour is picked automatically. */
export function Badge({ label, tone }) {
  const c = useColors();
  if (!label) return null;
  const t = tone ?? STATUS_TONE[String(label).toUpperCase().replace(/\s+/g, '_')] ?? 'primary';
  const color = { success: c.success, danger: c.danger, warning: c.warning, muted: c.muted, primary: c.primary }[t];
  return (
    <View style={{ borderColor: color, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{String(label).replace(/_/g, ' ')}</Text>
    </View>
  );
}
/** Dropdown: opens a bottom sheet with the options. */
export function Select({ label, value, options, onChange, placeholder = 'Select…', error }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, { borderColor: error ? c.danger : c.border, backgroundColor: c.card }]}>
        <Text style={{ color: selected ? c.text : c.muted, fontSize: 16, flex: 1 }} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{label}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.length === 0 ? <Muted>No options</Muted> : null}
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[styles.option, { borderBottomColor: c.border }]}>
                <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{o.label}</Text>
                {o.value === value ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
const pad = (n) => String(n).padStart(2, '0');
/** "YYYY-MM-DD" in local time (what the backend expects for dates). */
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "HH:MM" in local time. */
export const toHHMM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Date (or time) field with the native picker. Value is "YYYY-MM-DD" (or "HH:MM" for mode="time"). */
export function DateField({ label, value, onChange, mode = 'date', error, minimumDate }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const current = (() => {
    if (!value) return new Date();
    if (mode === 'time') {
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h || 0, m || 0, 0, 0);
      return d;
    }
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  })();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, { borderColor: error ? c.danger : c.border, backgroundColor: c.card }]}>
        <Text style={{ color: value ? c.text : c.muted, fontSize: 16, flex: 1 }}>
          {value || (mode === 'time' ? 'Pick a time' : 'Pick a date')}
        </Text>
        <Ionicons name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={18} color={c.muted} />
      </Pressable>
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : null}
      {open ? (
        <DateTimePicker
          value={current}
          mode={mode}
          minimumDate={minimumDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && date) {
              onChange(mode === 'time' ? toHHMM(date) : toISODate(date));
              if (Platform.OS === 'ios') setOpen(false);
            }
            if (event.type === 'dismissed') setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
/** Horizontal segmented tabs inside a screen (e.g. "My requests | Approvals"). */
export function Segments({ value, options, onChange }) {
  const c = useColors();
  return (
    <View style={[styles.segments, { backgroundColor: c.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.card }]}>
            <Text style={{ color: active ? c.text : c.muted, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
/** Floating "+" button for create actions on list screens. */
export function Fab({ onPress, icon = 'add' }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.fab, { backgroundColor: c.primary }]}>
      <Ionicons name={icon} size={28} color="#fff" />
    </Pressable>
  );
}
/** Menu row with icon + chevron (used by More / Admin menus). */
export function MenuRow({ icon, label, hint, onPress }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, { borderBottomColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color={c.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {hint ? <Muted style={{ fontSize: 12 }}>{hint}</Muted> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { padding: 16, paddingBottom: 32, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  option: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segments: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
