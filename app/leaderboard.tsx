import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { Avatar } from '@/components/Avatar';
import { ChoicePill } from '@/components/ChoicePill';
import { HelpButton } from '@/components/HelpButton';
import { Podium } from '@/components/Podium';
import { useLeaderboard } from '@/data/friends';
import { useProfile } from '@/data/profile';
import { useRestDays } from '@/data/restDays';
import { useTrainedDates } from '@/data/stats';
import { consistency } from '@/domain/achievements';
import {
  LEADERBOARD_METRICS,
  LEADERBOARD_PERIODS,
  METRIC_HAS_PERIOD,
  METRIC_LABEL,
  PERIOD_LABEL,
  PODIUM_PLACES,
  formatMetric,
  metricNote,
  rankLeaderboard,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from '@/domain/leaderboard';
import { currentStreak } from '@/domain/stats';
import { todayLocal } from '@/lib/dates';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const METRIC_CHOICES = LEADERBOARD_METRICS.map((id) => ({ id, label: METRIC_LABEL[id] }));
const PERIOD_CHOICES = LEADERBOARD_PERIODS.map((id) => ({ id, label: PERIOD_LABEL[id] }));

/**
 * You and your friends, ranked on one figure at a time, with the top three on a
 * podium. Who appears is decided by `rpc_friend_leaderboard`: you plus accepted
 * friends, nobody else.
 */
export default function Leaderboard() {
  const router = useRouter();
  const profile = useProfile();
  const unit = profile.data?.unit ?? 'lb';
  const [metric, setMetric] = useState<LeaderboardMetric>('streak');
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const board = useLeaderboard(period);
  const trainedDates = useTrainedDates();
  const restDays = useRestDays();
  const today = todayLocal();

  // Your own row uses the same local figures as your Profile, so the two never
  // disagree. Friends' come from the server, worked out by the same rules.
  const mine = useMemo(() => {
    if (!trainedDates.data || !restDays.data) return null;
    const rest = restDays.data.map((r) => r.rest_date);
    return {
      currentStreak: currentStreak(trainedDates.data, today, rest),
      consistency: Math.round(consistency(trainedDates.data, today, 30, rest) * 100),
    };
  }, [trainedDates.data, restDays.data, today]);

  const rows = useMemo(() => {
    const people = (board.data ?? []).map((p) => (p.isMe && mine ? { ...p, ...mine } : p));
    return rankLeaderboard(people, metric, unit);
  }, [board.data, mine, metric, unit]);
  const aloneOnBoard = !board.isLoading && rows.filter((r) => !r.person.isMe).length === 0;
  const openFriend = (id: string) => router.push(`/friend/${id}`);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={board.isFetching && !board.isLoading}
            onRefresh={() => board.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.choices}>
          <ChoicePill title="Rank by" value={metric} choices={METRIC_CHOICES} onChange={setMetric} />
          {METRIC_HAS_PERIOD[metric] ? (
            <ChoicePill title="Over" value={period} choices={PERIOD_CHOICES} onChange={setPeriod} />
          ) : null}
          <View style={styles.help}>
            <HelpButton title={METRIC_LABEL[metric]} body={metricNote(metric, period)} />
          </View>
        </View>

        {board.isLoading ? (
          <Text style={text.bodyMuted}>Loading…</Text>
        ) : board.isError && rows.length === 0 ? (
          <Text style={text.bodyMuted}>Could not load the leaderboard. Pull down to try again.</Text>
        ) : rows.length === 0 ? (
          <Text style={text.bodyMuted}>Nobody on this board yet.</Text>
        ) : (
          <>
            <Podium rows={rows} metric={metric} unit={unit} onOpen={openFriend} />
            {rows.length > PODIUM_PLACES ? (
              <View style={styles.list}>
                {rows.slice(PODIUM_PLACES).map((r) => (
                  <Pressable
                    key={r.person.userId}
                    disabled={r.person.isMe}
                    onPress={() => openFriend(r.person.userId)}
                    style={({ pressed }) => [
                      styles.row,
                      r.person.isMe && styles.meRow,
                      pressed && styles.rowPressed,
                    ]}
                    accessibilityRole={r.person.isMe ? undefined : 'button'}
                    accessibilityLabel={`Rank ${r.rank}, ${r.person.isMe ? 'you' : r.person.username}, ${formatMetric(r.value, metric, unit)}`}
                  >
                    <Text style={styles.rank}>{r.rank}</Text>
                    <Avatar name={r.person.displayName || r.person.username} size={34} />
                    <Text style={[text.body, styles.name]} numberOfLines={1}>
                      {r.person.isMe ? 'you' : r.person.username}
                    </Text>
                    <Text style={styles.score}>{formatMetric(r.value, metric, unit)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}

        {aloneOnBoard ? (
          <View style={styles.alone}>
            <Text style={text.bodyMuted}>Add friends to see how you stack up.</Text>
            <Button
              label="Find friends"
              variant="secondary"
              onPress={() => router.push('/find-friends')}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  choices: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  help: { marginLeft: 'auto' },
  list: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: -1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  meRow: { backgroundColor: colors.surfaceRaised },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rank: { color: colors.textMuted, fontSize: 14, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  name: { flex: 1 },
  score: { color: colors.text, fontSize: 16, fontWeight: '800' },
  alone: { gap: spacing.md, alignItems: 'center' },
});
