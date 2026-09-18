import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components';
import { FeedCard } from '@/components/FeedCard';
import { Field } from '@/components/Field';
import { keyboardAware } from '@/components/keyboard';
import { useFriendFeed, useReact } from '@/data/feed';
import {
  useFriendships,
  useLeaderboard,
  useRemoveFriend,
  useRespondToRequest,
  useSearchUsers,
  useSendFriendRequest,
} from '@/data/friends';
import { useProfile } from '@/data/profile';
import { TIER_COLOR } from '@/domain/achievements';
import type { ReactionId } from '@/domain/feed';
import {
  LEADERBOARD_METRICS,
  LEADERBOARD_PERIODS,
  METRIC_HAS_PERIOD,
  METRIC_LABEL,
  PERIOD_LABEL,
  formatMetric,
  metricNote,
  rankLeaderboard,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from '@/domain/leaderboard';
import { todayLocal } from '@/lib/dates';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

type Tab = 'feed' | 'leaders' | 'friends';

export default function FriendsScreen() {
  const [tab, setTab] = useState<Tab>('feed');
  const friendships = useFriendships();
  const incoming = (friendships.data ?? []).filter((e) => e.status === 'pending' && !e.outgoing);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.tabs}>
        <TabButton label="Feed" active={tab === 'feed'} onPress={() => setTab('feed')} />
        <TabButton
          label="Leaderboard"
          active={tab === 'leaders'}
          onPress={() => setTab('leaders')}
        />
        <TabButton
          label="Friends"
          badge={incoming.length}
          active={tab === 'friends'}
          onPress={() => setTab('friends')}
        />
      </View>

      {tab === 'feed' ? (
        <FeedTab />
      ) : tab === 'leaders' ? (
        <LeaderboardTab onFindFriends={() => setTab('friends')} />
      ) : (
        <FriendsTab />
      )}
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  badge = 0,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// --- Feed -------------------------------------------------------------------

/**
 * The stream of sessions from people you are actually friends with. Who may
 * appear here is decided entirely by `rpc_friend_feed`; nothing is filtered in
 * this screen.
 */
function FeedTab() {
  const router = useRouter();
  const { userId } = useAuth();
  const feed = useFriendFeed();
  const react = useReact();

  // Relative timestamps need the clock. It is read once in a lazy initialiser
  // and then only from the interval, so the cards themselves render purely and
  // the "3h ago" line still does not go stale while the tab is open.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const posts = feed.data ?? [];

  const onReact = (postKey: string, reaction: ReactionId) => {
    const post = posts.find((p) => p.key === postKey);
    if (!post) return;
    react.mutate(
      { post, reaction },
      {
        onError: (error) =>
          Alert.alert(
            'Could not react',
            error instanceof Error ? error.message : 'Please try again.',
          ),
      },
    );
  };

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.key}
      contentContainerStyle={styles.feed}
      refreshControl={
        <RefreshControl
          refreshing={feed.isFetching && !feed.isLoading}
          onRefresh={() => feed.refetch()}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item }) => (
        <FeedCard
          post={item}
          nowMs={nowMs}
          isMine={item.userId === userId}
          onReact={(reaction) => onReact(item.key, reaction)}
          onOpenProfile={() => router.push(`/friend/${item.userId}`)}
        />
      )}
      ListEmptyComponent={
        feed.isLoading ? (
          <Text style={text.bodyMuted}>Loading…</Text>
        ) : (
          <View style={styles.empty}>
            <Text style={text.heading}>Nothing here yet</Text>
            <Text style={[text.bodyMuted, styles.emptyText]}>
              Sessions you and your friends finish show up here. Add someone from the Friends tab,
              or log a workout of your own.
            </Text>
          </View>
        )
      }
    />
  );
}

// --- Leaderboard --------------------------------------------------------------

/** Medal colours for the top three, borrowed from the trophy tiers. */
const MEDAL = [TIER_COLOR.gold, TIER_COLOR.silver, TIER_COLOR.wood];

/**
 * You and your friends, ranked on one figure at a time. Who appears is decided
 * by `rpc_friend_leaderboard`: you plus accepted friends, nobody else.
 */
function LeaderboardTab({ onFindFriends }: { onFindFriends: () => void }) {
  const router = useRouter();
  const profile = useProfile();
  const unit = profile.data?.unit ?? 'lb';
  const [metric, setMetric] = useState<LeaderboardMetric>('streak');
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const board = useLeaderboard(period);
  const today = todayLocal();

  const rows = useMemo(
    () => rankLeaderboard(board.data ?? [], metric, today, unit),
    [board.data, metric, today, unit],
  );
  const aloneOnBoard = !board.isLoading && rows.filter((r) => !r.person.isMe).length === 0;

  return (
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
      <View style={styles.chips}>
        {LEADERBOARD_METRICS.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMetric(m)}
            style={[styles.chip, metric === m && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: metric === m }}
          >
            <Text style={[styles.chipText, metric === m && styles.chipTextOn]}>
              {METRIC_LABEL[m]}
            </Text>
          </Pressable>
        ))}
      </View>

      {METRIC_HAS_PERIOD[metric] ? (
        <View style={styles.periods}>
          {LEADERBOARD_PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.period, period === p && styles.periodOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
            >
              <Text style={[styles.chipText, period === p && styles.chipTextOn]}>
                {PERIOD_LABEL[p]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Card title={METRIC_LABEL[metric]}>
        {board.isLoading ? (
          <Text style={text.bodyMuted}>Loading…</Text>
        ) : board.isError && rows.length === 0 ? (
          <Text style={text.bodyMuted}>Could not load the leaderboard. Pull down to try again.</Text>
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.person.userId}
              disabled={r.person.isMe}
              onPress={() => router.push(`/friend/${r.person.userId}`)}
              style={({ pressed }) => [
                styles.row,
                r.person.isMe && styles.meRow,
                pressed && styles.rowPressed,
              ]}
              accessibilityLabel={`Rank ${r.rank}, ${r.person.isMe ? 'you' : r.person.username}, ${formatMetric(r.value, metric, unit)}`}
            >
              <View
                style={[
                  styles.rank,
                  r.rank <= 3 && r.value > 0 && { borderColor: MEDAL[r.rank - 1] },
                ]}
              >
                <Text
                  style={[
                    styles.rankText,
                    r.rank <= 3 && r.value > 0 && { color: MEDAL[r.rank - 1] },
                  ]}
                >
                  {r.rank}
                </Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={text.body} numberOfLines={1}>
                  @{r.person.username}
                  {r.person.isMe ? <Text style={text.caption}>{'  you'}</Text> : null}
                </Text>
                {r.person.displayName ? (
                  <Text style={text.caption} numberOfLines={1}>
                    {r.person.displayName}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.score}>{formatMetric(r.value, metric, unit)}</Text>
            </Pressable>
          ))
        )}
        <Text style={[text.caption, styles.note]}>{metricNote(metric, period)}</Text>
      </Card>

      {aloneOnBoard ? (
        <Card title="Just you so far">
          <Text style={text.bodyMuted}>Add friends to see how you stack up.</Text>
          <Button label="Find friends" variant="secondary" onPress={onFindFriends} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

// --- Friend management ------------------------------------------------------

function FriendsTab() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const friendships = useFriendships();
  const search = useSearchUsers(query);
  const sendRequest = useSendFriendRequest();
  const respond = useRespondToRequest();
  const removeFriend = useRemoveFriend();

  const edges = friendships.data ?? [];
  const accepted = edges.filter((e) => e.status === 'accepted');
  const incoming = edges.filter((e) => e.status === 'pending' && !e.outgoing);
  const outgoing = edges.filter((e) => e.status === 'pending' && e.outgoing);

  const knownIds = new Set(edges.map((e) => e.otherUserId));

  return (
    <ScrollView contentContainerStyle={styles.content} {...keyboardAware}>
      <Card title="Find lifters">
        <Field
          label="Search by username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="at least 2 characters"
        />
        {query.trim().length >= 2 ? (
          search.isLoading ? (
            <Text style={text.bodyMuted}>Searching…</Text>
          ) : (search.data ?? []).length === 0 ? (
            <Text style={text.bodyMuted}>No users found.</Text>
          ) : (
            (search.data ?? []).map((u) => (
              <View key={u.user_id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={text.body}>@{u.username}</Text>
                  {u.display_name ? <Text style={text.caption}>{u.display_name}</Text> : null}
                </View>
                {knownIds.has(u.user_id) ? (
                  <Text style={text.caption}>already connected</Text>
                ) : (
                  <Button
                    label="Add"
                    onPress={() =>
                      sendRequest.mutate(u.user_id, {
                        onError: (e) =>
                          Alert.alert(
                            'Could not send request',
                            e instanceof Error ? e.message : 'Try again.',
                          ),
                      })
                    }
                  />
                )}
              </View>
            ))
          )
        ) : null}
      </Card>

      {incoming.length > 0 ? (
        <Card title={`Requests · ${incoming.length}`}>
          {incoming.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={text.body}>@{e.username}</Text>
                <Text style={text.caption}>wants to be friends</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  label="Decline"
                  variant="ghost"
                  onPress={() => respond.mutate({ id: e.id, accept: false })}
                />
                <Button label="Accept" onPress={() => respond.mutate({ id: e.id, accept: true })} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card title={`Friends · ${accepted.length}`}>
        {accepted.length === 0 ? (
          <Text style={text.bodyMuted}>
            No friends yet. Search for a username above to send a request.
          </Text>
        ) : (
          accepted.map((e) => (
            <Pressable
              key={e.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/friend/${e.otherUserId}`)}
              onLongPress={() =>
                Alert.alert('Remove friend?', `@${e.username}`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => removeFriend.mutate(e.id),
                  },
                ])
              }
            >
              <View style={styles.rowMain}>
                <Text style={text.body}>@{e.username}</Text>
                {e.displayName ? <Text style={text.caption}>{e.displayName}</Text> : null}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))
        )}
      </Card>

      {outgoing.length > 0 ? (
        <Card title="Sent requests">
          {outgoing.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={text.body}>@{e.username}</Text>
                <Text style={text.caption}>waiting for them to accept</Text>
              </View>
              <Pressable onPress={() => removeFriend.mutate(e.id)} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  tabBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  tabBadgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },

  feed: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  emptyText: { textAlign: 'center' },

  content: { padding: spacing.lg, gap: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowMain: { gap: 2, flexShrink: 1, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },
  cancel: { color: colors.danger, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: colors.onPrimary },
  periods: { flexDirection: 'row', gap: spacing.sm },
  period: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  meRow: { backgroundColor: colors.surfaceRaised },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  score: { color: colors.text, fontSize: 16, fontWeight: '800' },
  note: { marginTop: spacing.sm },
});
