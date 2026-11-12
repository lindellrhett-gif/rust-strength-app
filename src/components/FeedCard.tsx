import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import { BadgeStrip } from './BadgeShelf';
import { FeaturedTrophies } from './FeaturedTrophies';
import { PostPoster } from './PostPoster';
import { GlyphIcon } from './TrophyIcon';
import { evaluateBadges } from '@/domain/badges';
import { REACTIONS, relativeTime, type FeedPost, type ReactionId } from '@/domain/feed';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

interface FeedCardProps {
  post: FeedPost;
  /** Passed in rather than read from the clock, so the card renders purely. */
  nowMs: number;
  onReact: (reaction: ReactionId) => void;
  /** Tapping the name opens their profile. Left out when there's nowhere to go. */
  onOpenProfile?: () => void;
  /** The viewer's own post: it says "You". */
  isMine: boolean;
}

/**
 * One post in the friend feed: who, a big graphic of the session, reactions,
 * and what they trained.
 *
 * A post is a summary. It never shows individual sets: that is a deliberate
 * limit enforced in `rpc_friend_feed`, not a detail left out for space.
 */
export const FeedCard = memo(function FeedCard({
  post,
  nowMs,
  onReact,
  onOpenProfile,
  isMine,
}: FeedCardProps) {
  // Level badges need a level, which the feed deliberately does not fetch per
  // author; the strip only renders awarded badges, so level 1 is the right
  // neutral input here.
  const badges = evaluateBadges(1, post.badgeIds);
  const who = isMine ? 'You' : post.username;
  const linked = !isMine && !!onOpenProfile;

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <Pressable
          onPress={onOpenProfile}
          disabled={!linked}
          hitSlop={6}
          style={styles.author}
          accessibilityRole={linked ? 'button' : undefined}
          accessibilityLabel={linked ? `Open ${post.username}'s profile` : undefined}
        >
          <Avatar name={post.displayName || post.username} size={34} />
          <Text style={styles.name} numberOfLines={1}>
            {who}
          </Text>
          <FeaturedTrophies keys={post.featuredTrophies} size={20} />
          <BadgeStrip badges={badges} />
        </Pressable>
        <Text style={text.caption}>{relativeTime(post.occurredAt, nowMs)}</Text>
      </View>

      <PostPoster
        post={post}
        // Double-tapping adds a reaction but never takes one away.
        onDoubleTap={post.myReaction ? undefined : () => onReact('fire')}
      />

      <View style={styles.reactions}>
        {REACTIONS.map((reaction) => {
          const count = post.reactionCounts[reaction.id] ?? 0;
          const mine = post.myReaction === reaction.id;
          return (
            <Pressable
              key={reaction.id}
              accessibilityRole="button"
              accessibilityState={{ selected: mine }}
              accessibilityLabel={`${reaction.label}${count > 0 ? `, ${count}` : ''}`}
              onPress={() => onReact(reaction.id)}
              hitSlop={4}
              style={({ pressed }) => [styles.reaction, pressed && styles.reactionPressed]}
            >
              <GlyphIcon
                glyph={reaction.glyph}
                color={mine ? reaction.color : colors.textMuted}
                size={24}
              />
              {count > 0 ? (
                <Text style={[styles.reactionCount, mine && { color: reaction.color }]}>
                  {count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {post.exercises.length > 0 ? (
        <Text style={styles.caption} numberOfLines={2}>
          <Text style={styles.captionName}>{who} </Text>
          {post.exercises.join(', ')}
          {post.moreExercises > 0 ? ` +${post.moreExercises} more` : ''}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  post: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },

  reactions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 44,
    minHeight: 40,
  },
  reactionPressed: { opacity: 0.6 },
  reactionCount: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },

  caption: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  captionName: { color: colors.text, fontWeight: '700' },
});
