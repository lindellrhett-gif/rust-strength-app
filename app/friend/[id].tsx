import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, LoadingView, StatTile } from '@/components';
import { AchievementStrip } from '@/components/AchievementGrid';
import { Avatar } from '@/components/Avatar';
import { BadgeShelf } from '@/components/BadgeShelf';
import { FeaturedTrophies } from '@/components/FeaturedTrophies';
import { FeedCard } from '@/components/FeedCard';
import { LevelCard, levelTint } from '@/components/LevelCard';
import { PostTile } from '@/components/PostTile';
import { ReportUserModal } from '@/components/ReportUserModal';
import { SettingGroup, SettingRow } from '@/components/SettingRow';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useGrantedBadges } from '@/data/badges';
import { useFriendPosts, useReact } from '@/data/feed';
import { useFriendPRs, useFriendStats } from '@/data/friends';
import { useProfile } from '@/data/profile';
import { useBlockUser, useReportUser } from '@/data/privacy';
import { evaluateAchievements, totalTiersEarned } from '@/domain/achievements';
import { evaluateBadges } from '@/domain/badges';
import { formatDurationShort } from '@/domain/duration';
import type { ReactionId } from '@/domain/feed';
import { friendDataUnit, friendVolume } from '@/domain/friendProfile';
import { MUSCLE_GROUPS } from '@/domain/stats';
import { computeXp, levelProgress, strengthScore } from '@/domain/xp';
import { compact } from '@/lib/format';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

const GRID_GAP = 2;
const GRID_COLUMNS = 3;

export default function FriendProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stats = useFriendStats(id);
  const prs = useFriendPRs(id);
  const posts = useFriendPosts(id);
  const badgeIds = useGrantedBadges(id);
  const me = useProfile();
  const react = useReact();

  const unit = me.data?.unit ?? 'lb';
  const theirUnit = friendDataUnit(stats.data?.unit, unit);
  const router = useRouter();
  const report = useReportUser();
  const block = useBlockUser();
  const [showReport, setShowReport] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [openPost, setOpenPost] = useState<{ key: string; openedAt: number } | null>(null);
  // Separate from which post it is, so the post stays in the sheet as it slides away.
  const [postSheetOpen, setPostSheetOpen] = useState(false);
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

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
      // Their numbers in their unit, as their own phone scores them. This screen
      // shows tiers from these, not the weights, so no weight appears in their unit.
      unit: theirUnit,
      runDistanceM: stats.data.runDistanceM,
      stepsTotal: stats.data.stepsTotal,
      friendCount: stats.data.friendCount,
      reactionsReceived: stats.data.reactionsReceived,
    });
  }, [stats.data, prs.data, theirUnit]);

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
      // One total from the server once 0037 is on, since a bodyweight exercise's
      // own number no longer comes through; added up here before that.
      strengthScore: stats.data.strengthScore ?? strengthScore(prs.data?.bestE1rm ?? {}),
      unit: theirUnit,
    });
  }, [stats.data, achievements, prs.data, theirUnit]);

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
  // Looked up each render, so a reaction in the open post shows straight away.
  const shownPost = openPost ? (posts.data ?? []).find((p) => p.key === openPost.key) : undefined;
  // If a refresh takes the post away, the sheet closes and doesn't reopen by itself.
  if (postSheetOpen && !shownPost) setPostSheetOpen(false);

  const confirmBlock = () =>
    Alert.alert(
      `Block @${s.username}?`,
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
              Alert.alert('Could not block', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );

  const openSafety = () =>
    Alert.alert(
      `@${s.username}`,
      'Report them if they are harassing you, using an offensive name, or pretending to be someone else. Blocking removes any friendship and hides you from each other.',
      [
        { text: 'Report', onPress: () => setShowReport(true) },
        { text: 'Block', style: 'destructive', onPress: confirmBlock },
        { text: 'Cancel', style: 'cancel' },
      ],
    );

  const onReact = (reaction: ReactionId) => {
    if (!shownPost) return;
    react.mutate(
      { post: shownPost, reaction },
      {
        onError: (error) =>
          Alert.alert('Could not react', error instanceof Error ? error.message : 'Please try again.'),
      },
    );
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Avatar
          name={s.displayName || s.username}
          size={72}
          ringColor={level ? levelTint(level.level) : null}
        />
        <View style={styles.counts}>
          <Count value={s.currentStreak} label="streak" />
          <Count value={s.totalWorkouts} label="workouts" />
          <Count value={s.friendCount} label="friends" />
        </View>
      </View>

      <View style={styles.names}>
        {s.displayName ? (
          <Text style={styles.displayName} numberOfLines={1}>
            {s.displayName}
          </Text>
        ) : null}
        <View style={styles.levelRow}>
          {level ? (
            <Text style={styles.level} numberOfLines={1}>
              Level {level.level} · {level.title}
            </Text>
          ) : null}
          <FeaturedTrophies keys={s.featuredTrophies} size={24} />
        </View>
      </View>

      <SettingGroup>
        <SettingRow label="Stats, trophies and badges" onPress={() => setShowDetails(true)} />
      </SettingGroup>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: `@${s.username}`,
          headerRight: () => (
            <Pressable
              onPress={openSafety}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Report or block @${s.username}`}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={posts.data ?? []}
        keyExtractor={(post) => post.key}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <PostTile
            post={item}
            size={tileSize}
            onPress={() => {
              setOpenPost({ key: item.key, openedAt: Date.now() });
              setPostSheetOpen(true);
            }}
          />
        )}
        ListEmptyComponent={
          <Text style={[text.bodyMuted, styles.none]}>
            {posts.isLoading
              ? 'Loading…'
              : posts.isError
                ? 'Could not load their sessions.'
                : 'No shared sessions.'}
          </Text>
        }
      />

      <SettingsSheet
        visible={postSheetOpen && !!shownPost}
        title={shownPost?.title ?? ''}
        onClose={() => setPostSheetOpen(false)}
      >
        {shownPost && openPost ? (
          <FeedCard post={shownPost} nowMs={openPost.openedAt} isMine={false} onReact={onReact} />
        ) : null}
      </SettingsSheet>

      <SettingsSheet
        visible={showDetails}
        title={`@${s.username}`}
        onClose={() => setShowDetails(false)}
      >
        {level ? <LevelCard level={level} name={`@${s.username}`} /> : null}
        <View style={styles.tiles}>
          <StatTile value={`${s.currentStreak}`} label="day streak" />
          <StatTile value={`${s.bestStreak}`} label="best streak" />
          <StatTile value={`${s.consistency30}%`} label="consistency (30d)" />
          <StatTile value={`${s.totalWorkouts}`} label="workouts" />
          <StatTile
            value={compact(friendVolume(s.totalVolume, s.unit, unit))}
            label={`${unit} lifted`}
          />
          <StatTile value={formatDurationShort(s.totalSeconds)} label="time training" />
          <StatTile value={compact(s.totalReps)} label="reps" />
          <StatTile value={compact(s.totalSets)} label="sets" />
        </View>
        <Card title="Trophies">
          <AchievementStrip achievements={achievements} />
        </Card>
        <Card title="Badges">
          <BadgeShelf badges={badges} showLocked={false} />
        </Card>
      </SettingsSheet>

      <ReportUserModal
        visible={showReport}
        username={s.username}
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

function Count({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.count} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  counts: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  count: { alignItems: 'center' },
  countValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  names: { gap: 2 },
  displayName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  level: { color: colors.textMuted, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  grid: { gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  none: { paddingHorizontal: spacing.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
