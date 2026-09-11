import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  REST_PRESETS,
  REST_STEP_SECONDS,
  formatRest,
  restLabel,
  restProgress,
} from '@/domain/restTimer';
import { useRestTimer } from '@/providers/RestTimerProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface RestTimerBarProps {
  /**
   * Hide the bar entirely while idle. Used on the add-set screen, where an
   * idle timer would just be another thing in the way of logging the set.
   */
  hideWhenIdle?: boolean;
}

/**
 * The rest timer, as a bar.
 *
 * Idle it offers the usual durations; running it counts down and can be nudged;
 * finished it holds "Rest over" until dismissed, so a set logged twenty seconds
 * later still tells you the rest actually elapsed.
 */
export function RestTimerBar({ hideWhenIdle = false }: RestTimerBarProps) {
  const timer = useRestTimer();
  const idle = !timer.running && !timer.finished;

  if (idle && hideWhenIdle) return null;

  if (timer.finished) {
    return (
      <View style={[styles.bar, styles.barDone]}>
        <View style={styles.main}>
          <Text style={styles.doneTitle}>Rest over</Text>
          <Text style={text.caption}>{restLabel(timer.totalSeconds)} rest complete</Text>
        </View>
        <View style={styles.actions}>
          <Chip label="Again" onPress={() => timer.start(timer.totalSeconds)} />
          <Chip label="Done" onPress={timer.stop} emphasis />
        </View>
      </View>
    );
  }

  if (idle) {
    return (
      <View style={styles.bar}>
        <View style={styles.mainRow}>
          <Text style={text.label}>REST TIMER</Text>
          <Pressable onPress={() => timer.start()} hitSlop={8}>
            <Text style={styles.start}>Start {restLabel(timer.defaultSeconds)} ›</Text>
          </Pressable>
        </View>
        <View style={styles.presets}>
          {REST_PRESETS.map((seconds) => (
            <Chip key={seconds} label={restLabel(seconds)} onPress={() => timer.start(seconds)} />
          ))}
        </View>
      </View>
    );
  }

  const progress = restProgress(timer.totalSeconds, timer.remaining);

  return (
    <View style={[styles.bar, styles.barRunning]}>
      {/* Drains left to right as the rest runs out. */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <View style={styles.runRow}>
        <View style={styles.main}>
          <Text style={styles.countdown}>{formatRest(timer.remaining)}</Text>
          <Text style={text.caption}>rest remaining</Text>
        </View>
        <View style={styles.actions}>
          <Chip label={`−${REST_STEP_SECONDS}s`} onPress={() => timer.add(-REST_STEP_SECONDS)} />
          <Chip label={`+${REST_STEP_SECONDS}s`} onPress={() => timer.add(REST_STEP_SECONDS)} />
          <Chip label="Skip" onPress={timer.stop} emphasis />
        </View>
      </View>
    </View>
  );
}

function Chip({
  label,
  onPress,
  emphasis,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, emphasis && styles.chipEmphasis, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, emphasis && styles.chipTextEmphasis]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  barRunning: { borderColor: colors.primary },
  barDone: { borderColor: colors.success, backgroundColor: colors.surfaceRaised },

  main: { gap: 2, flexShrink: 1 },
  mainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  runRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },

  countdown: { color: colors.primary, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  doneTitle: { color: colors.success, fontSize: 20, fontWeight: '800' },
  start: { color: colors.primary, fontWeight: '800', fontSize: 15 },

  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: colors.primary },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipEmphasis: { borderColor: colors.primary },
  chipPressed: { backgroundColor: colors.border },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextEmphasis: { color: colors.primary },
});
