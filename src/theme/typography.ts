import { StyleSheet } from 'react-native';

import { colors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const text = StyleSheet.create({
  hero: { fontSize: 34, fontWeight: '800', color: colors.text },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, fontWeight: '400', color: colors.text },
  bodyMuted: { fontSize: 16, fontWeight: '400', color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.4 },
  caption: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  stat: { fontSize: 28, fontWeight: '800', color: colors.text },
});
