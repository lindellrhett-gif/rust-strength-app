import { StyleSheet, Text, View } from 'react-native';

import { useStepsToday } from '@/lib/useStepsToday';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

import { Button } from './Button';
import { Card } from './Card';

/**
 * Today's steps on the Today screen. Before the Motion & Fitness question has
 * been answered it offers to turn steps on, once, with a way to say no. After
 * a no, or on a phone that can't count steps, it shows nothing at all.
 */
export function StepsTodayCard() {
  const { access, steps, dismissed, request, dismiss } = useStepsToday();

  if (access === 'undetermined' && !dismissed) {
    return (
      <Card>
        <Text style={text.heading}>See your steps</Text>
        <Text style={text.bodyMuted}>
          Rust Strength can show today’s step count from your iPhone. It stays on your phone.
        </Text>
        <View style={styles.row}>
          <Button label="Show my steps" onPress={() => void request()} style={styles.flex} />
          <Button label="Not now" variant="ghost" onPress={dismiss} style={styles.flex} />
        </View>
      </Card>
    );
  }

  if (access !== 'granted' || steps == null) return null;

  const formatted = steps.toLocaleString('en-US');
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${formatted} steps today`}>
      <Text style={styles.value}>{formatted}</Text>
      <Text style={text.label}>STEPS TODAY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  value: { fontSize: 24, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
});
