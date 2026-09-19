import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Field, LoadingView, Screen } from '@/components';
import { AchievementGrid } from '@/components/AchievementGrid';
import { BadgeShelf } from '@/components/BadgeShelf';
import { LevelCard } from '@/components/LevelCard';
import { NumberStepper } from '@/components/NumberStepper';
import { RestAlertToggle } from '@/components/RestAlertToggle';
import { useMyLevel } from '@/data/level';
import { useProfile, useUpdateProfile } from '@/data/profile';
import { useRestDays } from '@/data/restDays';
import { useWorkoutDates } from '@/data/stats';
import { LEGAL } from '@/legal/config';
import { useAuth } from '@/providers/AuthProvider';
import { useOnboardingControls } from '@/providers/OnboardingProvider';
import {
  consistency,
  earnedCount,
  totalTiersEarned,
  totalTiersAvailable,
} from '@/domain/achievements';
import { MAX_REPS, repRangeOrDefault } from '@/domain/recommender';
import { REST_PRESETS, clampRest, restLabel } from '@/domain/restTimer';
import { EQUIPMENT_OPTIONS } from '@/domain/generator';
import { todayLocal } from '@/lib/dates';
import type { EquipmentKind, WeightUnit } from '@/lib/database.types';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const profile = useProfile();
  const update = useUpdateProfile();

  const dates = useWorkoutDates();
  const restDays = useRestDays();
  const today = todayLocal();
  const router = useRouter();
  const onboarding = useOnboardingControls();

  // XP, level, badges and trophies all come from one place, so this screen can
  // never disagree with the post-workout screen about what level you are.
  const { xp, level, badges, achievements } = useMyLevel();

  const [handle, setHandle] = useState<string | null>(null);
  const [rest, setRest] = useState<number | null>(null);
  const [low, setLow] = useState<number | null>(null);
  const [high, setHigh] = useState<number | null>(null);
  const [bw, setBw] = useState<number | null>(null);

  if (profile.isLoading || !profile.data) return <LoadingView />;

  const p = profile.data;
  const repLow = low ?? p.target_rep_low;
  const repHigh = high ?? p.target_rep_high;
  const rangeDirty = repLow !== p.target_rep_low || repHigh !== p.target_rep_high;

  const bodyWeight = bw ?? p.body_weight ?? 0;
  const bwDirty = bw != null && bw !== p.body_weight;

  const equipment = p.equipment ?? [];
  const restSeconds = rest ?? p.rest_seconds;
  const restDirty = restSeconds !== p.rest_seconds;
  const consistency30 = Math.round(
    consistency(
      dates.data ?? [],
      today,
      30,
      (restDays.data ?? []).map((r) => r.rest_date),
    ) * 100,
  );

  const setUnit = (unit: WeightUnit) => update.mutate({ unit });

  const saveRange = () => {
    const [lo, hi] = repRangeOrDefault(repLow, repHigh);
    update.mutate(
      { target_rep_low: lo, target_rep_high: hi },
      {
        onSuccess: () => {
          setLow(null);
          setHigh(null);
        },
      },
    );
  };

  const saveBodyWeight = () => {
    update.mutate(
      { body_weight: bodyWeight > 0 ? bodyWeight : null },
      { onSuccess: () => setBw(null) },
    );
  };

  const toggleEquipment = (kind: EquipmentKind) => {
    const next = equipment.includes(kind)
      ? equipment.filter((e) => e !== kind)
      : [...equipment, kind];
    update.mutate({ equipment: next });
  };

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <View>
        <Text style={text.hero}>@{p.username}</Text>
        <Text style={text.bodyMuted}>
          {p.display_name ?? 'Lifter'} · {consistency30}% consistent (30d) ·{' '}
          {earnedCount(achievements)} trophies
        </Text>
      </View>

      <LevelCard level={level} breakdown={xp} />

      <Card title="Username">
        <Text style={text.bodyMuted}>
          {p.username_chosen
            ? 'Other people can find you by this handle.'
            : 'Pick a handle so friends can find you. Until you do, you are not searchable.'}
        </Text>
        <Field
          label="Username"
          value={handle ?? p.username}
          onChangeText={(v: string) => setHandle(v.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        <Text style={text.caption}>
          Letters, numbers and underscores. This is visible to anyone searching, so avoid using
          your real name or email if you would rather stay anonymous.
        </Text>
        {handle && handle !== p.username && handle.length >= 3 ? (
          <Button
            label="Save username"
            onPress={() => {
              update.mutate(
                { username: handle, username_chosen: true },
                {
                  onSuccess: () => setHandle(null),
                  onError: (e) =>
                    Alert.alert(
                      'Could not save',
                      e instanceof Error && e.message.includes('duplicate')
                        ? 'That username is taken.'
                        : 'Please try a different username.',
                    ),
                },
              );
            }}
            loading={update.isPending}
          />
        ) : null}
      </Card>

      <Card title="Bodyweight">
        <Text style={text.bodyMuted}>
          Used by the BW button when logging pull-ups, dips, push-ups and other bodyweight
          movements.
        </Text>
        <NumberStepper
          label={`Bodyweight (${p.unit})`}
          value={bodyWeight}
          onChange={setBw}
          step={p.unit === 'kg' ? 0.5 : 1}
          precision={1}
          min={0}
          max={1000}
        />
        {bwDirty ? (
          <Button label="Save bodyweight" onPress={saveBodyWeight} loading={update.isPending} />
        ) : null}
      </Card>

      <Card title="Units">
        <View style={styles.segment}>
          {(['lb', 'kg'] as const).map((u) => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              style={[styles.segmentBtn, p.unit === u && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, p.unit === u && styles.segmentTextActive]}>
                {u.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card title="Target rep range">
        <Text style={text.bodyMuted}>
          The recommender aims for you to reach failure inside this range.
        </Text>
        <View style={styles.rangeRow}>
          <NumberStepper label="Low reps" value={repLow} onChange={setLow} min={1} max={repHigh} />
          <NumberStepper
            label="High reps"
            value={repHigh}
            onChange={setHigh}
            min={repLow}
            max={MAX_REPS}
          />
        </View>
        {rangeDirty ? (
          <Button label="Save range" onPress={saveRange} loading={update.isPending} />
        ) : null}
      </Card>

      <Card title="My usual equipment">
        <Text style={text.bodyMuted}>
          Pre-selected when generating a workout. You can still change it each time.
        </Text>
        <View style={styles.chips}>
          {EQUIPMENT_OPTIONS.map((kind) => {
            const on = equipment.includes(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => toggleEquipment(kind)}
                style={[styles.chip, on && styles.chipActive]}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{kind}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title="Badges">
        <Text style={text.bodyMuted}>
          Levelling up unlocks these. Influencer and Beta Tester are handed out by us and cannot
          be earned in the app.
        </Text>
        <BadgeShelf badges={badges} />
      </Card>

      <Card title="Rest timer">
        <Text style={text.bodyMuted}>
          How long the timer runs between sets. It starts on its own when you save a working set.
        </Text>
        <View style={styles.chips}>
          {REST_PRESETS.map((seconds) => (
            <Pressable
              key={seconds}
              onPress={() => setRest(seconds)}
              style={[styles.chip, restSeconds === seconds && styles.chipActive]}
            >
              <Text style={[styles.chipText, restSeconds === seconds && styles.chipTextActive]}>
                {restLabel(seconds)}
              </Text>
            </Pressable>
          ))}
        </View>
        <NumberStepper
          label="Rest (seconds)"
          value={restSeconds}
          onChange={(v) => setRest(clampRest(v))}
          step={15}
          min={5}
          max={3600}
        />
        {restDirty ? (
          <Button
            label="Save rest time"
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { rest_seconds: clampRest(restSeconds) },
                { onSuccess: () => setRest(null) },
              )
            }
          />
        ) : null}
        <View style={styles.activityRow}>
          <View style={styles.toggleText}>
            <Text style={text.body}>Start automatically</Text>
            <Text style={text.caption}>Begin the rest timer as soon as a working set is saved.</Text>
          </View>
          <Switch
            value={p.rest_auto}
            onValueChange={(on) => update.mutate({ rest_auto: on })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <RestAlertToggle />
      </Card>

      <Card title="Sharing with friends">
        <View style={styles.activityRow}>
          <View style={styles.toggleText}>
            <Text style={text.body}>Show my sessions in the feed</Text>
            <Text style={text.caption}>
              Friends you have accepted see a summary of each workout and activity: its name,
              time, volume and which exercises you did. Individual sets are never shared. Turn
              this off and your sessions stop appearing for everyone.
            </Text>
          </View>
          <Switch
            value={p.share_workouts}
            onValueChange={(on) => update.mutate({ share_workouts: on })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Card>

      <Card
        title={`Trophies · ${totalTiersEarned(achievements)} of ${totalTiersAvailable(achievements)} tiers`}
      >
        <AchievementGrid achievements={achievements} />
      </Card>

      <Card title="Help">
        <Pressable
          style={styles.legalRow}
          onPress={() => onboarding?.replay()}
          disabled={!onboarding}
          accessibilityRole="button"
        >
          <View style={styles.helpText}>
            <Text style={text.body}>How this app works</Text>
            <Text style={text.caption}>Run through the welcome cards again</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </Card>

      <Card title="Privacy & legal">
        <Pressable style={styles.legalRow} onPress={() => router.push('/legal/privacy-center')}>
          <View>
            <Text style={text.body}>Privacy & legal</Text>
            <Text style={text.caption}>
              Documents, download your data, blocked users, delete account
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
        <Text style={text.caption}>
          {LEGAL.appName} is a logging tool, not medical or fitness advice. Lifting carries a real
          risk of injury — train within your limits.
        </Text>
      </Card>

      <Button
        label="Sign out"
        variant="danger"
        onPress={() =>
          Alert.alert('Sign out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  chev: { color: colors.textFaint, fontSize: 20 },
  helpText: { flex: 1, gap: 2 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleText: { flex: 1, gap: 2 },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '700' },
  segmentTextActive: { color: colors.onPrimary },
  rangeRow: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.onPrimary },
});
