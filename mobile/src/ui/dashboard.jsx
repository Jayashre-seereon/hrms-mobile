import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initials } from './format';
import { MenuButton } from './SideMenu';
import { useColors } from './theme';

/** Tone → [foreground, soft background] from the theme. */
export function toneColors(c, tone = 'primary') {
  const map = {
    primary: [c.primary, c.primarySoft],
    gold: [c.goldText, c.goldSoft],
    danger: [c.danger, c.dangerSoft],
    warning: [c.warning, c.warningSoft],
    info: [c.info, c.infoSoft],
    violet: [c.violet, c.violetSoft],
    orange: [c.orange, c.orangeSoft],
  };
  return map[tone] ?? map.primary;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/**
 * Emerald gradient hero like the web dashboard welcome card (bg-gradient-emerald + gold-ringed avatar).
 * Draws under the status bar; ☰ opens the side menu.
 */
export function Hero({ name, subtitle, right, children }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <LinearGradient
      colors={c.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 12 }]}>
      <View style={styles.heroBar}>
        <MenuButton light />
        <View style={[styles.dateChip, { backgroundColor: '#FFFFFF1F' }]}>
          <Ionicons name="calendar-outline" size={13} color="#FFFFFFD9" />
          <Text style={{ color: '#FFFFFFD9', fontSize: 12, fontWeight: '600' }}>{today}</Text>
        </View>
        {right ?? <View style={{ width: 40 }} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
        <View style={[styles.avatar, { borderColor: c.gold }]}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{initials(name || '?')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFFB3', fontSize: 13, fontWeight: '600' }}>{greeting()},</Text>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
            {name}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: '#FFFFFFB3', fontSize: 13, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </LinearGradient>
  );
}

/** KPI tile: tinted icon chip, big value, label (web stat cards). */
export function StatTile({ icon, label, value, hint, tone = 'primary', onPress }) {
  const c = useColors();
  const [fg, bg] = toneColors(c, tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.chip, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={fg} />
      </View>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', marginTop: 10 }}>{value ?? '—'}</Text>
      <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12.5, fontWeight: '600' }}>
        {label}
      </Text>
      {hint ? (
        <Text numberOfLines={1} style={{ color: fg, fontSize: 11.5, fontWeight: '600', marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Round icon + label shortcut, laid out 4 per row. */
export function QuickAction({ icon, label, tone = 'primary', onPress }) {
  const c = useColors();
  const [fg, bg] = toneColors(c, tone);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.qa, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.qaIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={fg} />
      </View>
      <Text numberOfLines={2} style={{ color: c.text, fontSize: 11.5, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Section title with optional "See all" link. */
export function SectionHeader({ title, action, onAction }) {
  const c = useColors();
  return (
    <View style={styles.sectionHead}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small rounded status pill. */
export function Pill({ label, tone = 'primary', icon }) {
  const c = useColors();
  const [fg, bg] = toneColors(c, tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Thin progress bar (leave balance used / entitled). */
export function Progress({ value = 0, tone = 'primary' }) {
  const c = useColors();
  const [fg, bg] = toneColors(c, tone);
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: bg, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: fg, borderRadius: 3 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingBottom: 56, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    backgroundColor: '#FFFFFF1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: { flexBasis: '30%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14 },
  chip: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qa: { width: '25%', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 2 },
  qaIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
});

/** Pulsing grey block shown while data loads (instead of an empty screen or a lone spinner). */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  const c = useColors();
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: c.mutedBg, opacity: pulse }, style]}
    />
  );
}

/** Placeholder grid of stat tiles. */
export function SkeletonTiles({ count = 3 }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.tile, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
          <Skeleton width={34} height={34} radius={10} />
          <Skeleton width="60%" height={20} />
          <Skeleton width="80%" height={11} />
        </View>
      ))}
    </View>
  );
}

/** Placeholder card with a title line and a few text lines. */
export function SkeletonCard({ lines = 3 }) {
  const c = useColors();
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        gap: 12,
        backgroundColor: c.card,
        borderColor: c.border,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Skeleton width={42} height={42} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="55%" height={15} />
          <Skeleton width="35%" height={11} />
        </View>
      </View>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </View>
  );
}
