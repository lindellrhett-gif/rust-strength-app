import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';

import { Button } from './Button';
import { NumberStepper } from './NumberStepper';
import { formatHold } from '@/domain/loadType';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** Seconds of "get ready" before the clock starts, to get into position. */
export const LEAD_IN_SECONDS = 3;
const KEEP_AWAKE_TAG = 'hold-timer';

interface Props {
  /** The hold, in seconds. */
  value: number;
  onChange: (seconds: number) => void;
  /** The suggested hold. The phone buzzes once when the timer passes it. */
  target: number | null;
}

/**
 * Times a plank or other hold, or takes a typed-in time.
 *
 * The clock is worked out from the moment it started rather than counted up,
 * so it stays right if the phone locks or the app is in the background. The
 * screen is kept awake while it runs: a phone on the floor beside a plank
 * should not dim.
 */
export function HoldTimer({ value, onChange, target }: Props) {
  // When the clock starts, which is the end of the lead-in; null when idle.
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const goBuzzedRef = useRef(false);
  const targetBuzzedRef = useRef(false);

  const phase = startAt == null ? 'idle' : now < startAt ? 'lead-in' : 'running';
  const leadInLeft = startAt == null ? 0 : Math.ceil((startAt - now) / 1000);
  const elapsed = startAt == null ? 0 : Math.max(0, Math.floor((now - startAt) / 1000));

  useEffect(() => {
    if (startAt == null) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      // Buzzes so nobody has to watch the screen: short at go, long at the target.
      if (t >= startAt && !goBuzzedRef.current) {
        goBuzzedRef.current = true;
        Vibration.vibrate(150);
      }
      if (target != null && t - startAt >= target * 1000 && !targetBuzzedRef.current) {
        targetBuzzedRef.current = true;
        Vibration.vibrate(500);
      }
    }, 200);
    return () => {
      clearInterval(id);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [startAt, target]);

  const start = () => {
    const t = Date.now();
    goBuzzedRef.current = false;
    targetBuzzedRef.current = false;
    setNow(t);
    setStartAt(t + LEAD_IN_SECONDS * 1000);
  };

  const stop = () => {
    const held = startAt == null ? 0 : Math.max(0, Math.floor((Date.now() - startAt) / 1000));
    setStartAt(null);
    if (held > 0) onChange(held);
  };

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return (
    <View style={styles.wrap}>
      <Text
        style={[styles.clock, phase === 'running' && target != null && elapsed >= target && styles.clockDone]}
        accessibilityLiveRegion="polite"
      >
        {phase === 'lead-in' ? `Get ready… ${leadInLeft}` : formatHold(phase === 'running' ? elapsed : value)}
      </Text>
      {target != null ? (
        <Text style={[text.caption, styles.center]}>
          {phase === 'running' && elapsed >= target
            ? 'Target reached. Keep going or stop.'
            : `Target ${formatHold(target)}`}
        </Text>
      ) : null}

      {phase === 'idle' ? (
        <Button label="Start timer" onPress={start} />
      ) : (
        <Button label={phase === 'lead-in' ? 'Cancel' : 'Stop'} variant="secondary" onPress={stop} />
      )}

      {phase === 'idle' ? (
        <>
          <Text style={[text.caption, styles.center]}>Or type the time you held.</Text>
          <View style={styles.row}>
            <View style={styles.cell}>
              <NumberStepper
                label="Min"
                value={minutes}
                onChange={(m) => onChange(m * 60 + seconds)}
                min={0}
                max={59}
              />
            </View>
            <View style={styles.cell}>
              <NumberStepper
                label="Sec"
                value={seconds}
                onChange={(s) => onChange(minutes * 60 + s)}
                min={0}
                max={59}
                step={5}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  clock: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  clockDone: { color: colors.success },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
});
