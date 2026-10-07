import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/data/profile';
import { DEFAULT_RUN_PREFERENCES, useRunHistory, useRunPreferences } from '@/data/runs';
import { weekGoalProgress } from '@/domain/running/history';
import { formatDistance, runUnitFor } from '@/domain/running/units';
import { weekStart } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

import { Card } from './Card';

/** This week's running on the Stats tab, and the way into the running hub. */
export function RunningCard() {
  const router = useRouter();
  const profile = useProfile();
  const unit = runUnitFor(profile.data?.unit ?? 'lb');
  const runs = useRunHistory().data ?? [];
  const prefs = useRunPreferences().data ?? DEFAULT_RUN_PREFERENCES;
  const today = todayLocal();
  const thisWeek = weekStart(today);
  const week = runs.filter((r) => r.date >= thisWeek && r.date <= today);
  const distance = week.reduce((s, r) => s + r.distanceM, 0);
  const goal = weekGoalProgress(runs, today, prefs.weeklyGoalM);

  const summary =
    runs.length === 0
      ? 'Record a run to see your weekly distance and records here.'
      : `${week.length === 1 ? '1 run' : `${week.length} runs`} this week` +
        (goal ? ` · goal ${formatDistance(goal.goalM, unit)}${goal.met ? ', met' : ''}` : '');

  return (
    <Pressable
      onPress={() => router.push('/run')}
      accessibilityRole="button"
      accessibilityLabel={`Running: ${formatDistance(distance, unit)} this week. ${summary}`}
      accessibilityHint="Opens your running history and records"
    >
      <Card title="Running">
        <View style={styles.row}>
          <Text style={text.stat}>{formatDistance(distance, unit)}</Text>
          <Text style={styles.link}>Open ›</Text>
        </View>
        <Text style={text.bodyMuted}>{summary}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  link: { color: colors.primary, fontWeight: '700' },
});
