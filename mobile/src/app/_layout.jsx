import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/lib/webAlert';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/store/session';
import { useColors } from '@/ui/theme';
SplashScreen.preventAutoHideAsync();
/** Navigation chrome in the brand / company colours (web theme). */
const navTheme = (base, c) => ({
  ...base,
  colors: { ...base.colors, primary: c.primary, background: c.background, card: c.card, text: c.text, border: c.border },
});
export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const status = useSession((s) => s.status);
  const mustChangePassword = useSession((s) => s.mustChangePassword);
  const bootstrap = useSession((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);
  if (status === 'loading') return null; // splash screen stays visible
  const signedIn = status === 'signedIn';
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme(scheme === 'dark' ? DarkTheme : DefaultTheme, c)}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="login" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && mustChangePassword}>
              <Stack.Screen name="change-password" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && !mustChangePassword}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
