import { StyleSheet, Text, View } from 'react-native';

import { TrophyIcon } from './TrophyIcon';
import { TIER_COLOR } from '@/domain/achievements';
import { earnedBadges, nextBadge, type EarnedBadge } from '@/domain/badges';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

interface BadgeShelfProps {
  badges: EarnedBadge[];
  /** Show locked level badges too. Off on a friend's profile. */
  showLocked?: boolean;
}

/**
 * Badges, drawn on the same hexagon medal as the trophies so the two systems
 * read as one collection rather than two competing ones.
 */
export function BadgeShelf({ badges, showLocked = true }: BadgeShelfProps) {
  const earned = earnedBadges(badges);
  const next = nextBadge(badges);
  const visible = showLocked ? badges : earned;

  if (visible.length === 0) {
    return (
      <Text style={text.bodyMuted}>
        No badges yet. Levelling up unlocks the first one at level 5.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {visible.map((badge) => (
          <View
            key={badge.id}
            style={[
              styles.tile,
              badge.earned ? { borderColor: TIER_COLOR[badge.tier] } : styles.locked,
            ]}
          >
            <TrophyIcon glyph={badge.glyph} tier={badge.earned ? badge.tier : null} size={42} />
            <Text style={styles.name} numberOfLines={1}>
              {badge.name}
            </Text>
            <Text style={styles.detail} numberOfLines={2}>
              {badge.earned ? badge.description : `${badge.levelsAway} levels away`}
            </Text>
          </View>
        ))}
      </View>

      {showLocked && next ? (
        <Text style={text.caption}>
          Next up: {next.name} at level {next.level}.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The compact strip used on feed cards and next to a username — awarded badges
 * only, because the point of an Influencer badge is that you can see it in the
 * feed without opening a profile.
 */
export function BadgeStrip({ badges, size = 18 }: { badges: EarnedBadge[]; size?: number }) {
  const granted = badges.filter((b) => b.earned && b.kind === 'granted');
  if (granted.length === 0) return null;

  return (
    <View style={styles.strip}>
      {granted.map((badge) => (
        <TrophyIcon key={badge.id} glyph={badge.glyph} tier={badge.tier} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  locked: { opacity: 0.55 },
  name: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  detail: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },

  strip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
