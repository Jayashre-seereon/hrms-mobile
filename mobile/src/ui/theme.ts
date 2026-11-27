import { useColorScheme } from 'react-native';

const light = {
  primary: '#1D4ED8',
  primaryText: '#FFFFFF',
  background: '#F4F6FA',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
};

const dark: typeof light = {
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  background: '#0B1120',
  card: '#111827',
  text: '#F1F5F9',
  muted: '#94A3B8',
  border: '#1F2937',
  danger: '#F87171',
  success: '#4ADE80',
  warning: '#FBBF24',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
