import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * A person's initial in a circle, with an optional coloured ring. There are no
 * profile pictures: the app collects no photos.
 */
export function Avatar({
  name,
  size = 44,
  ringColor,
}: {
  /** Display name or username; the first letter is shown. */
  name: string;
  size?: number;
  ringColor?: string | null;
}) {
  const initial = (Array.from(name.trim())[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringColor ? 2 : 1,
          borderColor: ringColor ?? colors.border,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  initial: { color: colors.text, fontWeight: '800' },
});
