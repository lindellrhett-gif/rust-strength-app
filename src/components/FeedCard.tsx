import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgeStrip } from './BadgeShelf';
import { RouteOutline } from './RouteOutline';
import { GlyphIcon } from './TrophyIcon';
import { evaluateBadges } from '@/domain/badges';
import { REACTIONS, relativeTime, type FeedPost, type ReactionId } from '@/domain/feed';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface FeedCardProps {
  post: FeedPost;
  /** Passed in rather than read from the clock, so the card renders purely. */
  nowMs: number;
  onReact: (reaction: ReactionId) => void;
  onOpenProfile: () => void;
  /** The viewer's own post — no profile link, and a quieter frame. */
  isMine: boolean;
}

/**
 * One post in the friend feed: what someone trained, how much work it was, and
 * a row of reactions.
 *
 * A card is a summary. It never shows individual sets — that is a deliberate
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
  const who = isMine ? 'You' : `@${post.username}`;

  return (
    <View style={[styles.card, post.recordCount > 0 && styles.cardRecord]}>
      <View style={styles.head}>
        <Pressable
          onPress={onOpenProfile}
          disabled={isMine}
          hitSlop={6}
          style={styles.author}
          accessibilityRole={isMine ? undefined : 'button'}
          accessibilityLabel={isMine ? undefined : `Open ${post.username}'s profile`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial(post)}</Text>
          </View>
          <View style={styles.authorText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {who}
              </Text>
              <BadgeStrip badges={badges} />
            </View>
            <Text style={text.caption}>{relativeTime(post.occurredAt, nowMs)}</Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {post.title}
      </Text>
      {post.headline ? (
        <Text style={[styles.headline, post.recordCount > 0 && styles.headlineRecord]}>
          {post.headline}
        </Text>
      ) : null}

      {post.route ? <RouteOutline points={post.route} /> : null}

      {post.stats.length > 0 ? (
        <View style={styles.stats}>
          {post.stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {post.exercises.length > 0 ? (
        <View style={styles.chips}>
          {post.exercises.map((name) => (
            <View key={name} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {name}
              </Text>
            </View>
          ))}
          {post.moreExercises > 0 ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>+{post.moreExercises} more</Text>
            </View>
          ) : null}
        </View>
      ) : null}

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
              style={({ pressed }) => [
                styles.reaction,
                mine && { borderColor: reaction.color, backgroundColor: `${reaction.color}22` },
                pressed && styles.reactionPressed,
              ]}
            >
              <GlyphIcon
                glyph={reaction.glyph}
                color={mine ? reaction.color : colors.textMuted}
                size={17}
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
    </View>
  );
});

function initial(post: FeedPost): string {
  const source = post.displayName?.trim() || post.username;
  return (source.slice(0, 1) || '?').toUpperCase();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardRecord: { borderColor: colors.warning },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textMuted, fontSize: 15, fontWeight: '800' },
  authorText: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },

  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  headline: { color: colors.textMuted, fontSize: 14 },
  headlineRecord: { color: colors.warning, fontWeight: '700' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  stat: { gap: 1 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: 11 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    maxWidth: '100%',
  },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  reactions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 46,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionPressed: { backgroundColor: colors.surfaceRaised },
  reactionCount: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
});
