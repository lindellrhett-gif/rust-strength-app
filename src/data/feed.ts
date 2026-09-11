import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  buildFeed,
  isReactionId,
  toggleReaction,
  type FeedPost,
  type FeedRow,
  type ReactionId,
} from '@/domain/feed';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from './profile';

const PAGE_SIZE = 30;

/**
 * The friend feed.
 *
 * Everything about who may appear here is decided server-side by
 * `rpc_friend_feed` — accepted friendships, the author's sharing preference and
 * blocks in both directions. Nothing is filtered in the app, so a change to the
 * client cannot widen what is visible.
 */
export function useFriendFeed() {
  const { userId } = useAuth();
  const profile = useProfile();
  const unit = profile.data?.unit ?? 'lb';

  return useQuery({
    queryKey: [...qk.feed, unit],
    enabled: !!userId,
    // A feed that never refreshes feels dead; a feed that refreshes constantly
    // burns the user's data plan for very little.
    staleTime: 60_000,
    queryFn: async (): Promise<FeedPost[]> => {
      const { data, error } = await supabase.rpc('rpc_friend_feed', { p_limit: PAGE_SIZE });
      if (error) throw error;

      const rows: FeedRow[] = (data ?? []).map((r) => ({
        subjectType: r.subject_type,
        subjectId: r.subject_id,
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        occurredAt: r.occurred_at,
        name: r.name,
        durationSeconds: Number(r.duration_seconds) || 0,
        volume: Number(r.volume) || 0,
        totalSets: Number(r.total_sets) || 0,
        totalReps: Number(r.total_reps) || 0,
        exerciseNames: r.exercise_names ?? [],
        recordCount: Number(r.record_count) || 0,
        badgeIds: r.badge_ids ?? [],
        activityKind: r.activity_kind,
        distance: r.distance == null ? null : Number(r.distance),
        distanceUnit: r.distance_unit,
        reactionCounts: normaliseCounts(r.reaction_counts),
        myReaction: r.my_reaction && isReactionId(r.my_reaction) ? r.my_reaction : null,
      }));

      return buildFeed(rows, unit);
    },
  });
}

/** jsonb arrives as a plain object; drop anything this build does not know. */
function normaliseCounts(raw: Record<string, number> | null): Partial<Record<ReactionId, number>> {
  const out: Partial<Record<ReactionId, number>> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (isReactionId(key)) out[key] = Number(value) || 0;
  }
  return out;
}

export interface ReactInput {
  post: FeedPost;
  reaction: ReactionId;
}

/**
 * Add, change or clear your reaction to a post.
 *
 * The cache is updated straight away so the tap feels instant, and rolled back
 * if the write fails. One row per person per post is enforced by a unique index,
 * so the upsert cannot stack reactions even if a double tap races.
 */
export function useReact() {
  const { userId } = useAuth();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ post, reaction }: ReactInput) => {
      const clearing = post.myReaction === reaction;

      if (clearing) {
        const { error } = await supabase
          .from('feed_reactions')
          .delete()
          .eq('subject_type', post.subjectType)
          .eq('subject_id', post.subjectId)
          .eq('user_id', userId!);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('feed_reactions').upsert(
        {
          subject_type: post.subjectType,
          subject_id: post.subjectId,
          user_id: userId!,
          reaction,
        },
        { onConflict: 'subject_type,subject_id,user_id' },
      );
      if (error) throw error;
    },

    onMutate: async ({ post, reaction }) => {
      await client.cancelQueries({ queryKey: qk.feed });
      const snapshots = client.getQueriesData<FeedPost[]>({ queryKey: qk.feed });

      for (const [key, posts] of snapshots) {
        if (!posts) continue;
        client.setQueryData<FeedPost[]>(
          key,
          posts.map((p) => (p.key === post.key ? toggleReaction(p, reaction) : p)),
        );
      }

      return { snapshots };
    },

    onError: (_error, _input, context) => {
      for (const [key, posts] of context?.snapshots ?? []) {
        client.setQueryData(key, posts);
      }
    },

    onSettled: () => client.invalidateQueries({ queryKey: qk.feed }),
  });
}
