import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useMenuGroups } from '@/features/nav/menu';
import { displayName, profileOf, useSession } from '@/store/session';
import { companyBranding } from './brand';
import { initials } from './format';
import { useColors } from './theme';

/** Open / close the side menu from anywhere (☰ button, Menu tab). */
export const useSideMenu = create((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

/** ☰ button for headers. `light` = white icon on the emerald hero. */
export function MenuButton({ light = false }) {
  const c = useColors();
  const show = useSideMenu((s) => s.show);
  return (
    <Pressable
      onPress={show}
      hitSlop={10}
      accessibilityLabel="Open menu"
      style={({ pressed }) => [
        styles.menuBtn,
        { backgroundColor: light ? '#FFFFFF22' : c.mutedBg, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Ionicons name="menu" size={22} color={light ? '#FFFFFF' : c.text} />
    </Pressable>
  );
}

const WIDTH = Math.min(320, Math.round(Dimensions.get('window').width * 0.84));
const isActive = (path, href) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

/** Web-style sidebar as a slide-in drawer: dark emerald, gold active item, collapsible groups. Mounted once. */
export function SideMenu() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const open = useSideMenu((s) => s.open);
  const hide = useSideMenu((s) => s.hide);
  const me = useSession((s) => s.me);
  const signOut = useSession((s) => s.signOut);
  const scopeCompanyName = useSession((s) => s.scopeCompanyName);
  // Company logo + name inside a company (web sidebar brand block); Super Admin keeps the product mark.
  const brand = companyBranding(me);
  const companyName = brand.name ?? scopeCompanyName;
  const [logoFailed, setLogoFailed] = useState(false);
  const groups = useMenuGroups();
  const [closed, setClosed] = useState({});
  const [visible, setVisible] = useState(false);
  const x = useRef(new Animated.Value(-WIDTH)).current;

  useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else if (visible) {
      Animated.timing(x, { toValue: -WIDTH, duration: 180, useNativeDriver: true }).start(() => setVisible(false));
    }
  }, [open, visible, x]);

  const go = (href) => {
    hide();
    if (path !== href) router.navigate(href);
  };
  // Only the most specific match is active (/attendance/history, not also /attendance).
  const activeHref = groups
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => isActive(path, h))
    .sort((a, b) => b.length - a.length)[0];
  const p = profileOf(me);
  const name = displayName(me);
  const role = String(p.role ?? '').replace(/_/g, ' ');

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={hide} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#000',
              opacity: x.interpolate({ inputRange: [-WIDTH, 0], outputRange: [0, 0.45] }),
            },
          ]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityLabel="Close menu" />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            { width: WIDTH, backgroundColor: c.sidebar, paddingTop: insets.top, transform: [{ translateX: x }] },
          ]}>
          {/* Brand + user */}
          <View style={[styles.head, { borderBottomColor: c.sidebarBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {brand.logo && !logoFailed ? (
                <Image
                  source={{ uri: brand.logo }}
                  onError={() => setLogoFailed(true)}
                  resizeMode="contain"
                  style={[styles.logo, { backgroundColor: '#FFFFFF' }]}
                />
              ) : (
                <View style={[styles.logo, { backgroundColor: c.sidebarActive }]}>
                  <Text style={{ color: c.sidebarActiveText, fontWeight: '800', fontSize: 16 }}>
                    {(brand.name ?? 'S').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.sidebarText, fontWeight: '800', fontSize: 17 }}>
                  {brand.name ?? 'Seereon HRMS'}
                </Text>
                {brand.name ? (
                  <Text style={{ color: c.sidebarMuted, fontSize: 12 }}>Seereon HRMS</Text>
                ) : companyName ? (
                  <Text numberOfLines={1} style={{ color: c.sidebarMuted, fontSize: 12 }}>
                    {companyName}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={hide} hitSlop={10} accessibilityLabel="Close menu">
                <Ionicons name="close" size={22} color={c.sidebarMuted} />
              </Pressable>
            </View>
            <Pressable onPress={() => go('/profile')} style={[styles.user, { backgroundColor: c.sidebarAccent }]}>
              <View style={[styles.avatar, { borderColor: c.sidebarActive }]}>
                <Text style={{ color: c.sidebarText, fontWeight: '700' }}>{initials(name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.sidebarText, fontWeight: '700', fontSize: 15 }}>
                  {name}
                </Text>
                <Text numberOfLines={1} style={{ color: c.sidebarMuted, fontSize: 12, textTransform: 'capitalize' }}>
                  {[p.designation, role.toLowerCase()].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 10 }}>
            {groups.map((g) => {
              const groupActive = g.items.some((i) => i.href === activeHref);
              const isOpen = groupActive || !closed[g.key];
              return (
                <View key={g.key} style={{ marginBottom: 4 }}>
                  <Pressable onPress={() => setClosed((s) => ({ ...s, [g.key]: isOpen }))} style={styles.groupHead}>
                    <Text style={[styles.groupLabel, { color: c.sidebarMuted }]}>{g.label}</Text>
                    <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={14} color={c.sidebarMuted} />
                  </Pressable>
                  {isOpen
                    ? g.items.map((i) => {
                        const active = i.href === activeHref;
                        return (
                          <Pressable
                            key={i.href}
                            onPress={() => go(i.href)}
                            style={({ pressed }) => [
                              styles.item,
                              {
                                backgroundColor: active ? c.sidebarActive : pressed ? c.sidebarAccent : 'transparent',
                              },
                            ]}>
                            <Ionicons
                              name={i.icon}
                              size={19}
                              color={active ? c.sidebarActiveText : c.sidebarText}
                              style={{ opacity: active ? 1 : 0.85 }}
                            />
                            <Text
                              numberOfLines={1}
                              style={{
                                color: active ? c.sidebarActiveText : c.sidebarText,
                                fontWeight: active ? '700' : '500',
                                fontSize: 14.5,
                                flex: 1,
                              }}>
                              {i.label}
                            </Text>
                          </Pressable>
                        );
                      })
                    : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.foot, { borderTopColor: c.sidebarBorder, paddingBottom: insets.bottom + 10 }]}>
            <Pressable
              onPress={() => {
                hide();
                signOut();
              }}
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? c.sidebarAccent : 'transparent' }]}>
              <Ionicons name="log-out-outline" size={19} color={c.sidebarText} />
              <Text style={{ color: c.sidebarText, fontWeight: '600', fontSize: 14.5 }}>Sign out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  head: { padding: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 6,
  },
  groupLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    marginVertical: 1,
  },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingTop: 8 },
});
