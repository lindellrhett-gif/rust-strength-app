import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Decimal places to display / allow. */
  precision?: number;
  suffix?: string;
}

export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  precision = 0,
  suffix,
}: NumberStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const round = (n: number) => Number(n.toFixed(precision));
  const display = draft ?? String(round(value));

  const bump = (dir: 1 | -1) => onChange(round(clamp(value + dir * step)));

  const commit = () => {
    const parsed = Number(draft);
    setDraft(null);
    if (draft != null && draft.trim() !== '' && Number.isFinite(parsed)) {
      onChange(round(clamp(parsed)));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={text.label}>{label.toUpperCase()}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`decrease ${label}`}
          onPress={() => bump(-1)}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>−</Text>
        </Pressable>

        <View style={styles.valueBox}>
          <TextInput
            value={display}
            onChangeText={setDraft}
            onFocus={() => setDraft(String(round(value)))}
            onEndEditing={commit}
            onBlur={commit}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={styles.valueText}
          />
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`increase ${label}`}
          onPress={() => bump(1)}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  btn: {
    width: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { backgroundColor: colors.border },
  btnText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  valueBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  valueText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 60,
  },
  suffix: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
