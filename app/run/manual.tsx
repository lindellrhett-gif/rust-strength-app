import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, NumberStepper, Screen } from '@/components';
import { useProfile } from '@/data/profile';
import { DEFAULT_RUN_PREFERENCES, useRunPreferences, useSaveRun } from '@/data/runs';
import { toSeconds } from '@/domain/activities';
import { effortLabel } from '@/domain/running/edit';
import { buildManualRunInput, manualRunTitle, type ManualRunDraft } from '@/domain/running/manual';
import { formatPace, paceSeconds, fromUnit, runUnitFor, toKilograms } from '@/domain/running/units';
import { RUN_LIMITS } from '@/domain/running/validate';
import { newId } from '@/lib/ids';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const DAYS_BACK = 7;
const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Today and the six days before it, for the "when" chips. */
function recentDays(now: Date): { offset: number; label: string }[] {
  return Array.from({ length: DAYS_BACK }, (_, offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const label =
      offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { offset, label };
  });
}

export default function ManualRunScreen() {
  const router = useRouter();
  const profile = useProfile();
  const prefs = useRunPreferences().data ?? DEFAULT_RUN_PREFERENCES;
  const save = useSaveRun();
  const unit = runUnitFor(profile.data?.unit ?? 'lb');

  const [now] = useState(() => new Date());
  const [source, setSource] = useState<ManualRunDraft['source']>('treadmill');
  const [distance, setDistance] = useState(unit === 'mi' ? 3 : 5);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [seconds, setSeconds] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [startHour, setStartHour] = useState(() => Math.max(0, now.getHours() - 1));
  const [startMinute, setStartMinute] = useState(0);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [effort, setEffort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const movingSeconds = toSeconds(hours, minutes, seconds);
  const performedAt = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    d.setHours(startHour, startMinute, 0, 0);
    return d;
  }, [now, dayOffset, startHour, startMinute]);
  const pace = paceSeconds(fromUnit(distance, unit), movingSeconds, unit);
  const bodyweight = profile.data?.body_weight;

  const submit = () => {
    const result = buildManualRunInput(
      {
        source,
        distance,
        unit,
        movingSeconds,
        performedAt,
        title,
        note,
        effort,
        bodyweightKg: bodyweight ? toKilograms(bodyweight, profile.data?.unit ?? 'lb') : null,
        mapVisibility: prefs.mapDefault,
      },
      newId(),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    // Through the offline queue, like a recorded run.
    save.mutate(result.input);
    router.replace(`/run/${result.input.p_id}`);
  };

  return (
    <Screen scroll edges={['left', 'right']} contentStyle={styles.content}>
      <View style={styles.segment} accessibilityRole="tablist">
        {(['treadmill', 'manual'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSource(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: source === s }}
            style={[styles.segmentItem, source === s && styles.segmentItemOn]}
          >
            <Text style={[styles.segmentText, source === s && styles.segmentTextOn]}>
              {s === 'treadmill' ? 'Treadmill' : 'Outdoors, no GPS'}
            </Text>
          </Pressable>
        ))}
      </View>

      <NumberStepper
        label={`Distance (${unit})`}
        value={distance}
        onChange={setDistance}
        step={0.1}
        min={0}
        max={unit === 'mi' ? 250 : 400}
        precision={2}
        suffix={unit}
      />

      <View style={styles.block}>
        <Text style={text.label}>MOVING TIME</Text>
        <View style={styles.timeRow}>
          <View style={styles.flex}>
            <NumberStepper label="Hours" value={hours} onChange={setHours} min={0} max={47} />
          </View>
          <View style={styles.flex}>
            <NumberStepper label="Min" value={minutes} onChange={setMinutes} min={0} max={59} />
          </View>
          <View style={styles.flex}>
            <NumberStepper label="Sec" value={seconds} onChange={setSeconds} min={0} max={59} />
          </View>
        </View>
        <Text style={text.caption}>Pace {formatPace(pace, unit)}</Text>
      </View>

      <View style={styles.block}>
        <Text style={text.label}>WHEN</Text>
        <View style={styles.chips}>
          {recentDays(now).map((d) => (
            <Pressable
              key={d.offset}
              onPress={() => setDayOffset(d.offset)}
              accessibilityRole="radio"
              accessibilityState={{ selected: dayOffset === d.offset }}
              style={[styles.chip, dayOffset === d.offset && styles.chipOn]}
            >
              <Text style={[styles.chipText, dayOffset === d.offset && styles.chipTextOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.timeRow}>
          <View style={styles.flex}>
            <NumberStepper label="Start hour" value={startHour} onChange={setStartHour} min={0} max={23} />
          </View>
          <View style={styles.flex}>
            <NumberStepper label="Minute" value={startMinute} onChange={setStartMinute} step={5} min={0} max={55} />
          </View>
        </View>
        <Text style={text.caption}>
          Started {performedAt.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>

      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder={manualRunTitle(source)}
        maxLength={RUN_LIMITS.titleMax}
      />
      <Field
        label="Notes"
        value={note}
        onChangeText={setNote}
        placeholder="Incline, intervals, how it felt…"
        maxLength={RUN_LIMITS.noteMax}
        multiline
        style={styles.notes}
      />

      <View style={styles.block}>
        <Text style={text.label}>EFFORT</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EFFORTS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setEffort(effort === n ? null : n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: effort === n }}
              accessibilityLabel={`Effort ${n}, ${effortLabel(n).toLowerCase()}`}
              style={[styles.effort, effort === n && styles.chipOn]}
            >
              <Text style={[styles.chipText, effort === n && styles.chipTextOn]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Text style={text.caption}>
        No map, splits or records for a run entered by hand: there is no route to measure them from.
        It still counts toward your distance, weekly goal and streak.
      </Text>
      <Button label="Save run" size="lg" onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  block: { gap: spacing.sm },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: 3, gap: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentItemOn: { backgroundColor: colors.border },
  segmentText: { color: colors.textMuted, fontWeight: '600' },
  segmentTextOn: { color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  effort: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: colors.onPrimary },
  error: { color: colors.danger, fontSize: 15 },
});
