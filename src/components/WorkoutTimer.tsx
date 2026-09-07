import { useEffect, useReducer } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { elapsedSeconds, formatClock } from '@/domain/duration';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

interface WorkoutTimerProps {
  startedAt: string;
  /** When set, the workout is over and the clock freezes at its final value. */
  endedAt?: string | null;
  label?: string;
}

/**
 * Live elapsed-time display.
 *
 * The elapsed value is derived from `startedAt` during render rather than held
 * in state; the interval only forces a re-render. That keeps the clock correct
 * after the phone sleeps or the app is backgrounded, where timers are throttled
 * and an incrementing counter would drift.
 */
export function WorkoutTimer({ startedAt, endedAt, label = 'elapsed' }: WorkoutTimerProps) {
  const running = !endedAt;
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!running) return;

    const id = setInterval(tick, 1000);
    // Resync immediately on return from the background.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running]);

  const seconds = elapsedSeconds(startedAt, endedAt ?? undefined);

  return (
    <View>
      <Text style={[text.stat, running && styles.live]}>{formatClock(seconds)}</Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  live: { color: colors.primary },
});
