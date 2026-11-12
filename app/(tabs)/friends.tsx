import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { FeedCard } from '@/components/FeedCard';
import { FriendsRow } from '@/components/FriendsRow';
import { SharePrompt } from '@/components/SharePrompt';
import { useFriendFeed, useReact } from '@/data/feed';
import { useFriendships } from '@/data/friends';
import { useProfile } from '@/data/profile';
import type { ReactionId } from '@/domain/feed';
import { friendsRow, ringFor } from '@/domain/friendsRow';
import { toLocalDateString } from '@/lib/dates';
import { settledOrAfter } from '@/lib/pullRefresh';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** The leaderboard and finding friends, as icons in the tab's own header. */
function HeaderIcons() {
  const router = useRouter();
  const friendships = useFriendships();
  const requests = (friendships.data ?? []).filter((e) => e.status === 'pending' && !e.outgoing).length;

  return (
    <View style={styles.icons}>
      <Pressable
        onPress={() => router.push('/leaderboard')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Leaderboard"
      >
        <Ionicons name="trophy-outline" size={23} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={() => router.push('/find-friends')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          requests > 0
            ? `Find friends, ${requests} request${requests === 1 ? '' : 's'}`
            : 'Find friends'
        }
      >
        <Ionicons name="person-add-outline" size={23} color={colors.text} />
        {requests > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requests}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

// Outside the component so the header isn't set afresh on every render.
const HEADER_OPTIONS = { headerRight: () => <HeaderIcons /> };

/**
 * The Friends tab: who's around, then the stream of sessions from people you are
 * actually friends with. Who may appear is decided entirely by
 * `rpc_friend_feed`; nothing is filtered in this screen.
 */
export default function FriendsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const profile = useProfile();
  const friendships = useFriendships();
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

  const posts = useMemo(() => feed.data ?? [], [feed.data]);

  // Rechecked with the clock, so last night's ring goes at midnight.
  const today = useMemo(() => toLocalDateString(nowMs), [nowMs]);
  const { entries, myRing } = useMemo(() => {
    const isToday = (iso: string) => toLocalDateString(iso) === today;
    const accepted = (friendships.data ?? []).filter((e) => e.status === 'accepted');
    return {
      entries: friendsRow(accepted, posts, isToday),
      myRing: userId ? ringFor(userId, posts, isToday) : null,
    };
  }, [friendships.data, posts, today, userId]);

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

  // Only a pull shows the spinner. A background refetch, which follows every
  // reaction, would otherwise move the feed under your finger.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await settledOrAfter(Promise.allSettled([feed.refetch(), friendships.refetch()]));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <Tabs.Screen options={HEADER_OPTIONS} />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.key}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <SharePrompt />
            <FriendsRow
              myName={profile.data?.display_name || profile.data?.username || ''}
              myRing={myRing}
              entries={entries}
              onOpenMe={() => router.navigate('/(tabs)/profile')}
              onOpenFriend={(id) => router.push(`/friend/${id}`)}
              onFindFriends={() => router.push('/find-friends')}
            />
          </>
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
            <Text style={[text.bodyMuted, styles.loading]}>Loading…</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={text.heading}>Nothing here yet</Text>
              <Text style={[text.bodyMuted, styles.emptyText]}>
                Sessions you and your friends finish show up here.
              </Text>
              <Button
                label="Find friends"
                variant="secondary"
                onPress={() => router.push('/find-friends')}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  icons: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginRight: spacing.lg },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  list: { flexGrow: 1 },
  loading: { padding: spacing.lg },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyText: { textAlign: 'center' },
});
