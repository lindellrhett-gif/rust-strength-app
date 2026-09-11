import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, rpeColor } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** Half-point stops from 6 to 10 — the range the sets table accepts. */
const STOPS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

/** Whole numbers get a printed, tappable label; the halves get a short tick. */
const LABELLED = new Set<number>([6, 7, 8, 9, 10]);

const DESCRIPTIONS: Record<number, string> = {
  6: '4+ reps left in the tank',
  7: '3 reps left',
  8: '2 reps left',
  9: '1 rep left',
  10: 'nothing left — true failure',
};

const THUMB = 30;

interface RpeSelectorProps {
  value: number | null;
  onChange: (rpe: number) => void;
}

function describe(value: number | null): string {
  if (value == null) return 'Slide to rate how hard that set was';
  return DESCRIPTIONS[Math.floor(value)] ?? '';
}

function indexOfValue(value: number | null): number {
  if (value == null) return STOPS.indexOf(8);
  const exact = STOPS.indexOf(value as (typeof STOPS)[number]);
  if (exact >= 0) return exact;
  // A value that is not on a stop (an older set, or one edited by hand) snaps
  // to the nearest one rather than dropping the thumb at zero.
  let nearest = 0;
  for (let i = 1; i < STOPS.length; i += 1) {
    if (Math.abs(STOPS[i] - value) < Math.abs(STOPS[nearest] - value)) nearest = i;
  }
  return nearest;
}

/**
 * RPE as a slider.
 *
 * The scale is discrete, so the thumb snaps to half-point stops rather than
 * sliding continuously — an RPE of 8.37 would be a false reading. The track is
 * tinted by the value, which is what makes the scale legible at a glance while
 * you are out of breath between sets.
 *
 * Built on the view's own responder props rather than a slider package: the
 * control has nine stops and one colour rule, and a native dependency for that
 * would mean a rebuild every time the design moves.
 *
 * Until the lifter actually touches it the thumb reads "?" and stays hollow,
 * because a slider parked at 8 would otherwise look like an answer nobody gave.
 */
export function RpeSelector({ value, onChange }: RpeSelectorProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);
  // Written by measureInWindow and read inside the gesture callbacks. A ref
  // rather than state: the drag needs the value, the render does not.
  const originX = useRef(0);

  const index = indexOfValue(value);
  const tint = value == null ? colors.textFaint : rpeColor(value);

  const measure = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
    trackRef.current?.measureInWindow((x) => {
      originX.current = x;
    });
  };

  /** Absolute screen x to the nearest stop. */
  const commitFromX = (event: GestureResponderEvent) => {
    const span = trackWidth - THUMB;
    if (span <= 0) return;
    const ratio = (event.nativeEvent.pageX - originX.current - THUMB / 2) / span;
    const picked = STOPS[Math.round(Math.min(1, Math.max(0, ratio)) * (STOPS.length - 1))];
    if (picked !== value) onChange(picked);
  };

  const step = (delta: number) => {
    onChange(STOPS[Math.min(STOPS.length - 1, Math.max(0, index + delta))]);
  };

  const fillRatio = index / (STOPS.length - 1);
  const thumbLeft = fillRatio * Math.max(0, trackWidth - THUMB);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={text.label}>RPE — RATE OF PERCEIVED EXERTION</Text>
        <Text style={[styles.reading, { color: tint }]}>{value == null ? '—' : value}</Text>
      </View>

      <View
        ref={trackRef}
        onLayout={measure}
        style={styles.track}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Rate of perceived exertion"
        accessibilityValue={{ min: 6, max: 10, now: value ?? 8 }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') step(1);
          if (event.nativeEvent.actionName === 'decrement') step(-1);
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Hold the gesture so the surrounding ScrollView cannot steal the drag.
        onResponderTerminationRequest={() => false}
        onResponderGrant={commitFromX}
        onResponderMove={commitFromX}
      >
        <View style={styles.rail} />
        <View
          style={[
            styles.fill,
            { width: THUMB / 2 + thumbLeft, backgroundColor: tint },
            value == null && styles.fillUnset,
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: thumbLeft, borderColor: tint },
            value == null ? styles.thumbUnset : { backgroundColor: tint },
          ]}
        >
          <Text style={[styles.thumbText, value == null && styles.thumbTextUnset]}>
            {value == null ? '?' : value}
          </Text>
        </View>
      </View>

      {/* Tapping a number beats dragging when you already know the answer. */}
      <View style={styles.ticks}>
        {STOPS.map((stop) =>
          LABELLED.has(stop) ? (
            <Pressable
              key={stop}
              onPress={() => onChange(stop)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`RPE ${stop}`}
              style={styles.tick}
            >
              <Text style={[styles.tickText, value === stop && { color: rpeColor(stop) }]}>
                {stop}
              </Text>
            </Pressable>
          ) : (
            <View key={stop} style={styles.tick}>
              <View style={styles.tickMark} />
            </View>
          ),
        )}
      </View>

      <Text style={styles.desc}>{describe(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reading: { fontSize: 26, fontWeight: '800' },

  track: { height: THUMB + spacing.sm, justifyContent: 'center' },
  rail: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fill: { position: 'absolute', left: 0, height: 8, borderRadius: radius.pill },
  fillUnset: { opacity: 0.25 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbUnset: { backgroundColor: colors.surfaceRaised, borderStyle: 'dashed' },
  thumbText: { fontSize: 12, fontWeight: '800', color: colors.onPrimary },
  thumbTextUnset: { color: colors.textFaint },

  ticks: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { alignItems: 'center', minWidth: 18 },
  tickText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  tickMark: { width: 1, height: 6, backgroundColor: colors.border, marginTop: 4 },

  desc: { color: colors.textMuted, fontSize: 13, minHeight: 18 },
});
