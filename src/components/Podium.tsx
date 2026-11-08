import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import { GlyphIcon } from './TrophyIcon';
import { TIER_COLOR } from '@/domain/achievements';
import {
  formatMetric,
  podiumOrder,
  type LeaderboardMetric,
  type LeaderboardRow,
} from '@/domain/leaderboard';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/** Medal colours for the top three, borrowed from the trophy tiers. */
const MEDAL = [TIER_COLOR.gold, TIER_COLOR.silver, TIER_COLOR.wood];
const BLOCK_HEIGHT = [84, 60, 44];

/** The colour for a rank, once there's something to be ranked on. */
export function medalColor(rank: number, value: number): string | null {
  return rank <= 3 && value > 0 ? MEDAL[rank - 1] : null;
}

/** The top three on blocks: second, first, third. */
export function Podium({
  rows,
  metric,
  unit,
  onOpen,
}: {
  rows: LeaderboardRow[];
  metric: LeaderboardMetric;
  unit: 'lb' | 'kg';
  onOpen: (userId: string) => void;
}) {
  return (
    <View style={styles.podium}>
      {podiumOrder(rows).map(({ row, place }) => {
        const medal = medalColor(row.rank, row.value);
        const score = formatMetric(row.value, metric, unit);
        const name = row.person.isMe ? 'you' : row.person.username;
        return (
          <Pressable
            key={row.person.userId}
            disabled={row.person.isMe}
            onPress={() => onOpen(row.person.userId)}
            style={[styles.column, place === 1 && styles.columnFirst]}
            accessibilityRole={row.person.isMe ? undefined : 'button'}
            accessibilityLabel={`Rank ${row.rank}, ${name}, ${score}`}
          >
            {place === 1 && medal ? <GlyphIcon glyph="crown" color={medal} size={24} /> : null}
            <Avatar
              name={row.person.displayName || row.person.username}
              size={place === 1 ? 64 : 52}
              ringColor={medal}
            />
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={text.caption} numberOfLines={1}>
              {score}
            </Text>
            <View
              style={[
                styles.block,
                { height: BLOCK_HEIGHT[place - 1], backgroundColor: medal ?? colors.surfaceRaised },
              ]}
            >
              <Text style={[styles.rank, medal ? styles.rankOnMedal : null]}>{row.rank}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  column: { flex: 1, maxWidth: 130, alignItems: 'center', gap: spacing.xs },
  columnFirst: { flex: 1.15, maxWidth: 150 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  block: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  rank: { color: colors.textMuted, fontSize: 20, fontWeight: '800' },
  rankOnMedal: { color: colors.onPrimary },
});
