/**
 * Single permanent dark palette — no light mode, no toggle (by design for now).
 * Keep every screen and component pulling from here so a future theme swap is
 * a one-file change.
 */

export const colors = {
  // Surfaces
  background: '#0B0D10',
  surface: '#14181D',
  surfaceRaised: '#1C222A',
  border: '#2A323C',

  // Text
  text: '#F2F5F8',
  textMuted: '#9AA7B4',
  textFaint: '#5E6B78',

  // Brand / accent
  primary: '#4F8CFF',
  primaryPressed: '#3D6FD1',
  onPrimary: '#0B0D10',

  // Semantic
  success: '#3ECf8e',
  warning: '#F5B14C',
  danger: '#F26D6D',

  // RPE scale (6 → 10), cool to hot
  rpe6: '#3ECf8e',
  rpe7: '#8FD14F',
  rpe8: '#F5B14C',
  rpe9: '#F2854C',
  rpe10: '#F26D6D',
} as const;

export type ColorName = keyof typeof colors;

export const rpeColor = (rpe: number | null): string => {
  if (rpe == null) return colors.textFaint;
  if (rpe <= 6) return colors.rpe6;
  if (rpe <= 7) return colors.rpe7;
  if (rpe <= 8) return colors.rpe8;
  if (rpe <= 9) return colors.rpe9;
  return colors.rpe10;
};
