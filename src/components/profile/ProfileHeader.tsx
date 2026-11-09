import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../Avatar';
import { FeaturedTrophies, featuredTrophiesLabel } from '../FeaturedTrophies';
import { levelTint, XpBreakdownSheet } from '../LevelCard';
import { MiniStat, MiniStatRow } from '../MiniStat';
import type { LevelProgress, XpBreakdown } from '@/domain/xp';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const comma = (n: number) => Math.round(n).toLocaleString('en-US');

interface ProfileHeaderProps {
  username: string;
  displayName: string | null;
  level: LevelProgress;
  breakdown: XpBreakdown;
  featured: string[];
  streak: number;
  /** 0..100 over the last 30 days. */
  consistency30: number;
  trophyTiers: number;
}

/** Who you are and where you stand. Tapping it shows where your XP came from. */
export function ProfileHeader({
  username,
  displayName,
  level,
  breakdown,
  featured,
  streak,
  consistency30,
  trophyTiers,
}: ProfileHeaderProps) {
  const [open, setOpen] = useState(false);
  const tint = levelTint(level.level);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.level}
        accessibilityRole="button"
        accessibilityLabel={`@${username}. Level ${level.level}, ${level.title}. ${
          level.maxed ? 'Maximum level reached' : `${comma(level.xpToNext)} XP to level ${level.level + 1}`
        }. ${featuredTrophiesLabel(featured) ? `${featuredTrophiesLabel(featured)}. ` : ''}See where your XP came from.`}
      >
        <View style={styles.identity}>
          <Avatar name={displayName?.trim() || username} size={52} ringColor={tint} />
          <View style={styles.names}>
            <Text style={styles.handle} numberOfLines={1}>
              @{username}
            </Text>
            <Text style={styles.levelLine} numberOfLines={1}>
              Level {level.level} · {level.title}
            </Text>
          </View>
          <FeaturedTrophies keys={featured} size={26} />
        </View>

        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(level.progress * 100)}%`, backgroundColor: tint },
            ]}
          />
        </View>
        <Text style={text.caption}>
          {level.maxed
            ? 'Maximum level reached'
            : `${comma(level.xpToNext)} XP to level ${level.level + 1}`}
        </Text>
      </Pressable>

      <MiniStatRow>
        <MiniStat value={String(streak)} label="day streak" />
        <MiniStat
          value={`${consistency30}%`}
          label="consistent"
          spoken={`${consistency30} percent consistent over the last 30 days`}
          help={{
            title: 'Consistent',
            body: 'The share of the last 30 days you trained or marked a rest day.',
          }}
        />
        <MiniStat value={String(trophyTiers)} label="trophy tiers" />
      </MiniStatRow>

      <XpBreakdownSheet visible={open} onClose={() => setOpen(false)} breakdown={breakdown} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  level: { gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  names: { flex: 1, gap: 1 },
  handle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  levelLine: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.pill },
});
