import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.mark}>✓</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  mark: { color: colors.onPrimary, fontSize: 14, fontWeight: '900' },
  label: { color: colors.textMuted, fontSize: 14, flexShrink: 1 },
});
