import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, LoadingView, StatTile } from '@/components';
import { AchievementStrip } from '@/components/AchievementGrid';
import { BadgeShelf } from '@/components/BadgeShelf';
import { LevelCard } from '@/components/LevelCard';
import { ReportUserModal } from '@/components/ReportUserModal';
import { useGrantedBadges } from '@/data/badges';
import { useFriendPRs, useFriendStats } from '@/data/friends';
import { useProfile } from '@/data/profile';
import { useBlockUser, useReportUser } from '@/data/privacy';
import {
  earnedCount,
  evaluateAchievements,
  totalTiersEarned,
} from '@/domain/achievements';
import { evaluateBadges } from '@/domain/badges';
import { computeXp, levelProgress, strengthScore } from '@/domain/xp';
import { formatDurationShort } from '@/domain/duration';
import { MUSCLE_GROUPS } from '@/domain/stats';
import { compact } from '@/lib/format';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

export default function FriendProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stats = useFriendStats(id);
  const prs = useFriendPRs(id);
  const badgeIds = useGrantedBadges(id);
  const me = useProfile();

  const unit = me.data?.unit ?? 'lb';
  const router = useRouter();
  const report = useReportUser();
  const block = useBlockUser();
  const [showReport, setShowReport] = useState(false);

  const achievements = useMemo(() => {
    if (!stats.data) return [];
    return evaluateAchievements({
      totalWorkouts: stats.data.totalWorkouts,
      totalVolume: stats.data.totalVolume,
      totalReps: stats.data.totalReps,
      totalSets: stats.data.totalSets,
      totalSeconds: stats.data.totalSeconds,
      currentStreak: stats.data.currentStreak,
      bestStreak: stats.data.bestStreak,
      // Weekly coverage is private to each user, so a friend's full-body
      // trophy cannot be evaluated here.
      groupsThisWeek: 0,
      groupsTotal: MUSCLE_GROUPS.length,
      activitySeconds: stats.data.activitySeconds,
      activityCount: stats.data.activityCount,
      activityKinds: stats.data.activityKinds,
      bestWeightByExercise: prs.data?.bestWeight ?? {},
      bestRepsByExercise: prs.data?.bestReps ?? {},
      // A friend's numbers are stored in their own unit; we render in ours,
      // which is the same assumption the rest of this screen already makes.
      unit,
    });
  }, [stats.data, prs.data, unit]);

  /**
   * Their level, worked out by the same code that works out yours, from the
   * aggregates the server returns. Streaks come from the server with rest days
   * counted, so their rest days stay private and the level still matches.
   */
  const xp = useMemo(() => {
    if (!stats.data) return null;
    return computeXp({
      totalWorkouts: stats.data.totalWorkouts,
      totalSets: stats.data.totalSets,
      totalVolume: stats.data.totalVolume,
      totalActivities: stats.data.activityCount,
      bestStreak: stats.data.bestStreak,
      friendCount: stats.data.friendCount,
      trophyTiers: totalTiersEarned(achievements),
      strengthScore: strengthScore(prs.data?.bestE1rm ?? {}),
      unit,
    });
  }, [stats.data, achievements, prs.data, unit]);

  const level = xp ? levelProgress(xp.total) : null;
  const badges = evaluateBadges(level?.level ?? 1, badgeIds.data ?? []);

  if (stats.isLoading) return <LoadingView />;
  if (stats.isError) {
    return (
      <EmptyState
        title="Can't view this profile"
        message="You can only see the profile of someone you're friends with."
      />
    );
  }
  if (!stats.data) return <EmptyState title="Profile not found" />;

  const s = stats.data;
  const streak = s.currentStreak;
  const best = s.bestStreak;
  const consistency30 = s.consistency30;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: `@${s.username}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={text.hero}>@{s.username}</Text>
          <Text style={text.bodyMuted}>
            {s.displayName ?? 'Lifter'} · {earnedCount(achievements)} trophies
          </Text>
        </View>

        <View style={styles.tiles}>
          <StatTile value={`${streak}`} label="day streak" />
          <StatTile value={`${best}`} label="best streak" />
          <StatTile value={`${consistency30}%`} label="consistency (30d)" />
          <StatTile value={`${s.totalWorkouts}`} label="workouts" />
          <StatTile value={compact(s.totalVolume)} label={`${unit} lifted`} />
          <StatTile value={formatDurationShort(s.totalSeconds)} label="time training" />
          <StatTile value={compact(s.totalReps)} label="reps" />
          <StatTile value={compact(s.totalSets)} label="sets" />
        </View>

        {level ? <LevelCard level={level} name={`@${s.username}`} /> : null}

        <Card title="Trophies">
          <AchievementStrip achievements={achievements} />
        </Card>

        <Card title="Badges">
          <BadgeShelf badges={badges} showLocked={false} />
        </Card>

        <Card title="Safety">
          <Text style={text.bodyMuted}>
            If this person is harassing you, using an offensive name, or pretending to be someone
            else, let us know. Blocking removes any friendship and hides you from each other.
          </Text>
          <View style={styles.safetyRow}>
            <Pressable onPress={() => setShowReport(true)} hitSlop={8} style={styles.safetyBtn}>
              <Text style={styles.reportText}>Report</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.safetyBtn}
              onPress={() =>
                Alert.alert(
                  `Block @${stats.data?.username ?? ''}?`,
                  'You will no longer appear to each other, and any friendship is removed. You can undo this in Privacy & legal.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Block',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await block.mutateAsync(id!);
                          router.back();
                        } catch (e) {
                          Alert.alert(
                            'Could not block',
                            e instanceof Error ? e.message : 'Please try again.',
                          );
                        }
                      },
                    },
                  ],
                )
              }
            >
              <Text style={styles.blockText}>Block</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
      <ReportUserModal
        visible={showReport}
        username={stats.data?.username ?? ''}
        busy={report.isPending}
        onClose={() => setShowReport(false)}
        onSubmit={async (reason, details) => {
          try {
            await report.mutateAsync({ reportedId: id!, reason, details });
            setShowReport(false);
            Alert.alert(
              'Report sent',
              'Thanks — we review every report. You can also block this person so you no longer appear to each other.',
            );
          } catch (e) {
            Alert.alert('Could not report', e instanceof Error ? e.message : 'Please try again.');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safetyRow: { flexDirection: 'row', gap: spacing.lg },
  safetyBtn: { paddingVertical: spacing.xs },
  reportText: { color: colors.warning, fontWeight: '700' },
  blockText: { color: colors.danger, fontWeight: '700' },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
