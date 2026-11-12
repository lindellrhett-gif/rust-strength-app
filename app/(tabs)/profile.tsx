import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, LoadingView, Screen } from '@/components';
import { InlineNumber } from '@/components/InlineNumber';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import {
  EquipmentRow,
  ProRow,
  RestTimerRow,
  UsernameRow,
} from '@/components/profile/ProfileSheets';
import { SettingGroup, SettingRow, type HelpContent } from '@/components/SettingRow';
import { useMyLevel } from '@/data/level';
import { useProfile, useUpdateProfile, type ProfileUpdate } from '@/data/profile';
import { useRestDays } from '@/data/restDays';
import { useTrainedDates } from '@/data/stats';
import { useSetStepGoal, useStepGoal } from '@/data/stepGoal';
import { useSetShareSteps } from '@/data/trophies';
import {
  consistency,
  refreshFeatured,
  totalTiersAvailable,
  totalTiersEarned,
} from '@/domain/achievements';
import { hasFeature } from '@/domain/entitlements';
import { editRepRange } from '@/domain/inlineEdit';
import { MAX_REPS, repRangeOrDefault } from '@/domain/recommender';
import { shareChoice } from '@/domain/sharePrompt';
import { currentStreak } from '@/domain/stats';
import { STEP_GOAL_MAX, STEP_GOAL_MIN, cleanStepGoal } from '@/domain/todayTiles';
import { LEGAL } from '@/legal/config';
import { todayLocal } from '@/lib/dates';
import { subscriptionsOn } from '@/lib/purchases';
import { useAuth } from '@/providers/AuthProvider';
import { useOnboardingControls } from '@/providers/OnboardingProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const HELP: Record<'bodyweight' | 'repRange' | 'stepGoal' | 'sharing', HelpContent> = {
  bodyweight: {
    title: 'Bodyweight',
    body: 'Used by the BW button when logging pull-ups, dips, push-ups and other bodyweight movements.',
  },
  repRange: {
    title: 'Rep range',
    body: 'The weight suggestion aims for you to reach failure inside this range.',
  },
  stepGoal: {
    title: 'Daily step goal',
    body: 'Today shows your steps out of this goal. It stays on your phone, like your steps.',
  },
  sharing: {
    title: 'Sharing with friends',
    body: [
      'Show my sessions in the feed: friends you have accepted see a summary of each workout and activity, including ones you logged earlier, in their feed and on your profile: its name, time, volume, sets, reps, records and which exercises you did. Individual sets are never shared. Turn this off and your sessions stop appearing for everyone.',
      'Share daily steps: puts you on the steps leaderboard and counts toward the Steps trophy. Friends see your step totals, nothing else. Turning this off deletes the totals already shared.',
    ],
  },
};

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const onboarding = useOnboardingControls();
  const profile = useProfile();
  const update = useUpdateProfile();
  const dates = useTrainedDates();
  const restDays = useRestDays();
  const shareSteps = useSetShareSteps();
  const stepGoal = useStepGoal().data ?? cleanStepGoal(null);
  const saveStepGoal = useSetStepGoal();

  const bodyweightField = useRef<TextInput>(null);
  const stepGoalField = useRef<TextInput>(null);

  // XP, level, badges and trophies all come from one place, so this screen can
  // never disagree with the post-workout screen about what level you are.
  const { xp, level, achievements, trophiesSettled } = useMyLevel();

  // Featured trophies at the tiers held now: one shown at Silver moves up at
  // Gold, and one no longer held drops off. Saved back once everything the
  // trophies rest on has arrived, never from half-loaded numbers.
  const storedFeatured = profile.data?.featured_trophies ?? [];
  const featured = trophiesSettled ? refreshFeatured(storedFeatured, achievements) : storedFeatured;
  const featuredKey = featured.join(',');
  const storedKey = storedFeatured.join(',');
  const { mutate: saveProfile } = update;
  // Tried once per change. A failed save puts the stored value back, which would
  // otherwise set this off again for as long as the server keeps failing.
  const featuredTried = useRef<string | null>(null);
  useEffect(() => {
    if (!trophiesSettled || featuredKey === storedKey || featuredTried.current === featuredKey) return;
    featuredTried.current = featuredKey;
    saveProfile({ featured_trophies: featuredKey ? featuredKey.split(',') : [] });
  }, [trophiesSettled, featuredKey, storedKey, saveProfile]);

  if (profile.isLoading || !profile.data) return <LoadingView />;

  const p = profile.data;
  const today = todayLocal();
  const rest = (restDays.data ?? []).map((r) => r.rest_date);
  const trained = dates.data ?? [];

  /** A setting saved the moment it changes, with a word if the save fails. */
  const save = (patch: ProfileUpdate) =>
    update.mutate(patch, {
      onError: (e) =>
        Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.'),
    });

  const saveRepEnd = (end: 'low' | 'high', value: number | null) => {
    if (value == null) return;
    const [lo, hi] = repRangeOrDefault(
      ...editRepRange([p.target_rep_low, p.target_rep_high], end, value),
    );
    save({ target_rep_low: lo, target_rep_high: hi });
  };

  const setShareSteps = (on: boolean) =>
    shareSteps.mutate(on, {
      onError: (e) =>
        Alert.alert(
          'Could not change step sharing',
          e instanceof Error ? e.message : 'Please try again.',
        ),
    });

  // The ? explains this too, but a switch that deletes something says so itself.
  const onShareSteps = (on: boolean) => {
    if (on) {
      setShareSteps(true);
      return;
    }
    Alert.alert('Stop sharing steps?', 'This deletes the step totals already shared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop sharing', style: 'destructive', onPress: () => setShareSteps(false) },
    ]);
  };

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <ProfileHeader
        username={p.username}
        displayName={p.display_name}
        level={level}
        breakdown={xp}
        featured={featured}
        streak={currentStreak(trained, today, rest)}
        consistency30={Math.round(consistency(trained, today, 30, rest) * 100)}
        trophyTiers={totalTiersEarned(achievements)}
      />

      {p.username_chosen ? null : (
        <Text style={styles.nudge}>
          Pick a username under More so friends can find you. Until you do, you are not searchable.
        </Text>
      )}

      <SettingGroup>
        <SettingRow
          label="Trophies and badges"
          value={`${totalTiersEarned(achievements)} of ${totalTiersAvailable(achievements)}`}
          onPress={() => router.push('/trophies')}
        />
      </SettingGroup>

      <SettingGroup title="Training">
        <SettingRow
          label="Bodyweight"
          help={HELP.bodyweight}
          onPressField={() => bodyweightField.current?.focus()}
        >
          <InlineNumber
            inputRef={bodyweightField}
            label={`Bodyweight in ${p.unit}`}
            value={p.body_weight}
            onCommit={(n) => save({ body_weight: n != null && n > 0 ? n : null })}
            min={0}
            max={1000}
            precision={1}
            suffix={p.unit}
            clearable
          />
        </SettingRow>

        <SettingRow label="Units">
          <View style={styles.segment}>
            {(['lb', 'kg'] as const).map((u) => (
              <Pressable
                key={u}
                onPress={() => save({ unit: u })}
                style={[styles.segmentBtn, p.unit === u && styles.segmentOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: p.unit === u }}
              >
                <Text style={[styles.segmentText, p.unit === u && styles.segmentTextOn]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </SettingRow>

        <SettingRow label="Rep range" help={HELP.repRange}>
          <View style={styles.range}>
            <InlineNumber
              label="Lowest reps"
              value={p.target_rep_low}
              onCommit={(n) => saveRepEnd('low', n)}
              min={1}
              max={MAX_REPS}
            />
            <Text style={text.caption}>to</Text>
            <InlineNumber
              label="Highest reps"
              value={p.target_rep_high}
              onCommit={(n) => saveRepEnd('high', n)}
              min={1}
              max={MAX_REPS}
            />
          </View>
        </SettingRow>

        <SettingRow
          label="Daily step goal"
          help={HELP.stepGoal}
          onPressField={() => stepGoalField.current?.focus()}
        >
          <InlineNumber
            inputRef={stepGoalField}
            label="Daily step goal"
            value={stepGoal}
            onCommit={(n) => {
              if (n != null) {
                saveStepGoal.mutate(n, {
                  onError: () => Alert.alert('Couldn’t save the goal', 'Please try again.'),
                });
              }
            }}
            min={STEP_GOAL_MIN}
            max={STEP_GOAL_MAX}
            grouped
          />
        </SettingRow>

        <EquipmentRow profile={p} />
        <RestTimerRow profile={p} />
      </SettingGroup>

      <SettingGroup
        title="Sharing with friends"
        help={HELP.sharing}
        footer="Summaries only, never single sets."
      >
        <SettingRow label="Show my sessions in the feed">
          <Switch
            value={p.share_workouts}
            onValueChange={(on) => save(shareChoice(on, p))}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Show my sessions in the feed"
          />
        </SettingRow>
        <SettingRow label="Share daily steps">
          <Switch
            value={shareSteps.isPending ? !!shareSteps.variables : p.share_steps}
            onValueChange={onShareSteps}
            disabled={shareSteps.isPending}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel="Share daily steps"
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="More">
        <UsernameRow profile={p} />
        {hasFeature('running') ? (
          <SettingRow label="Running settings" onPress={() => router.push('/run/settings')} />
        ) : null}
        {subscriptionsOn ? <ProRow /> : null}
        {onboarding ? (
          <SettingRow label="How this app works" onPress={() => onboarding.replay()} />
        ) : null}
        <SettingRow label="Privacy & legal" onPress={() => router.push('/legal/privacy-center')} />
      </SettingGroup>

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

      <Text style={styles.disclaimer}>
        {LEGAL.appName} is a logging tool, not medical or fitness advice. Lifting carries a real
        risk of injury, so train within your limits.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nudge: { ...text.caption, color: colors.warning },
  range: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segment: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    minWidth: 44,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '700' },
  segmentTextOn: { color: colors.onPrimary },
  disclaimer: { ...text.caption, textAlign: 'center' },
});
