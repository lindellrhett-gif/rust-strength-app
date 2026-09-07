import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field } from '@/components';
import { NumberStepper } from '@/components/NumberStepper';
import { useLogActivity } from '@/data/activities';
import {
  ACTIVITY_FIELDS,
  ACTIVITY_KINDS,
  ACTIVITY_LABEL,
  DISTANCE_UNITS,
  fromSeconds,
  toSeconds,
  validateActivity,
  type ActivityKind,
  type DistanceUnit,
} from '@/domain/activities';
import { formatClock, formatDurationShort } from '@/domain/duration';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function NewActivity() {
  const router = useRouter();
  const log = useLogActivity();

  const [kind, setKind] = useState<ActivityKind>('run');
  const [name, setName] = useState('');

  // Live timer. The displayed value lives in state and is only ever written by
  // the interval, so render stays pure — reading Date.now() during render would
  // make the clock jump on any unrelated re-render. `bankedRef` holds time from
  // earlier runs so pause/resume loses nothing.
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const bankedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);

  const [manual, setManual] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);

  const [distance, setDistance] = useState(0);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('mi');
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);

  useEffect(() => {
    if (!running) return;
    // Ticks faster than 1s so the display never visibly lags a second behind.
    const id = setInterval(() => {
      const start = startedAtRef.current;
      if (start != null) {
        setLiveSeconds(bankedRef.current + Math.floor((Date.now() - start) / 1000));
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const durationSeconds = manual ? toSeconds(hours, minutes) : liveSeconds;
  const fields = ACTIVITY_FIELDS[kind];

  const toggleTimer = () => {
    if (running) {
      bankedRef.current = liveSeconds;
      startedAtRef.current = null;
      setRunning(false);
    } else {
      bankedRef.current = liveSeconds;
      startedAtRef.current = Date.now();
      setRunning(true);
    }
  };

  const resetTimer = () => {
    startedAtRef.current = null;
    bankedRef.current = 0;
    setRunning(false);
    setLiveSeconds(0);
  };

  /** Switching to manual entry seeds the pickers from whatever the clock has. */
  const switchMode = (toManual: boolean) => {
    if (toManual) {
      startedAtRef.current = null;
      bankedRef.current = liveSeconds;
      setRunning(false);
      if (liveSeconds > 0) {
        const split = fromSeconds(liveSeconds);
        setHours(split.hours);
        setMinutes(split.minutes);
      }
    }
    setManual(toManual);
  };

  const validation = validateActivity({
    kind,
    durationSeconds,
    distance: fields.distance && distance > 0 ? distance : null,
    steps: fields.steps && steps > 0 ? steps : null,
    calories: fields.calories && calories > 0 ? calories : null,
  });

  const save = async () => {
    if (!validation.ok) return;
    try {
      await log.mutateAsync({
        kind,
        name,
        durationSeconds,
        distance: fields.distance && distance > 0 ? distance : null,
        distanceUnit: fields.distance && distance > 0 ? distanceUnit : null,
        steps: fields.steps && steps > 0 ? steps : null,
        calories: fields.calories && calories > 0 ? calories : null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Log activity' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card title="What did you do?">
          <View style={styles.chips}>
            {ACTIVITY_KINDS.map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.chip, kind === k && styles.chipOn]}
              >
                <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>
                  {ACTIVITY_LABEL[k]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Name (optional)"
            value={name}
            onChangeText={setName}
            placeholder={ACTIVITY_LABEL[kind]}
            maxLength={60}
          />
        </Card>

        <Card title="Time">
          <View style={styles.modeRow}>
            <Text style={text.body}>Enter time manually</Text>
            <Switch
              value={manual}
              onValueChange={switchMode}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          {manual ? (
            <>
              <NumberStepper label="Hours" value={hours} onChange={setHours} min={0} max={24} />
              <NumberStepper
                label="Minutes"
                value={minutes}
                onChange={setMinutes}
                min={0}
                max={59}
                step={5}
              />
            </>
          ) : (
            <>
              <Text style={styles.clock}>{formatClock(liveSeconds)}</Text>
              <View style={styles.timerRow}>
                <Button
                  label={running ? 'Pause' : liveSeconds > 0 ? 'Resume' : 'Start'}
                  onPress={toggleTimer}
                  style={styles.timerBtn}
                />
                <Button
                  label="Reset"
                  variant="secondary"
                  onPress={resetTimer}
                  disabled={liveSeconds === 0}
                  style={styles.timerBtn}
                />
              </View>
              <Text style={text.caption}>
                Keep this screen open while the timer runs, or switch to manual entry and type the
                time when you&apos;re done.
              </Text>
            </>
          )}
        </Card>

        {fields.distance || fields.steps || fields.calories ? (
          <Card title="Extras (optional)">
            {fields.distance ? (
              <>
                <NumberStepper
                  label="Distance"
                  value={distance}
                  onChange={setDistance}
                  min={0}
                  max={500}
                  step={0.1}
                  precision={2}
                  suffix={distanceUnit}
                />
                <View style={styles.unitRow}>
                  {DISTANCE_UNITS.map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setDistanceUnit(u)}
                      style={[styles.chip, distanceUnit === u && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, distanceUnit === u && styles.chipTextOn]}>
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {fields.steps ? (
              <NumberStepper
                label="Steps"
                value={steps}
                onChange={setSteps}
                min={0}
                max={200000}
                step={100}
              />
            ) : null}

            {fields.calories ? (
              <NumberStepper
                label="Calories burned"
                value={calories}
                onChange={setCalories}
                min={0}
                max={20000}
                step={10}
              />
            ) : null}

            <Text style={text.caption}>Leave anything at 0 to skip recording it.</Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {!validation.ok && durationSeconds > 0 ? (
          <Text style={styles.error}>{validation.error}</Text>
        ) : null}
        <Button
          label={`Save ${formatDurationShort(durationSeconds)}`}
          size="lg"
          onPress={save}
          disabled={!validation.ok}
          loading={log.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.onPrimary },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clock: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
  },
  timerRow: { flexDirection: 'row', gap: spacing.sm },
  timerBtn: { flex: 1 },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  error: { color: colors.danger, fontSize: 13 },
});
