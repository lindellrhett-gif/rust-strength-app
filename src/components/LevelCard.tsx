import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TIER_COLOR } from '@/domain/achievements';
import type { LevelProgress, XpBreakdown } from '@/domain/xp';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const comma = (n: number) => Math.round(n).toLocaleString('en-US');

interface LevelCardProps {
  level: LevelProgress;
  /** Omit on a friend's profile — the breakdown is the owner's business. */
  breakdown?: XpBreakdown;
  /** Shown instead of "You" on a friend's card. */
  name?: string;
}

/**
 * The level card: rank, title, and the bar toward the next level.
 *
 * Tapping it opens where the XP came from, which matters because XP here is
 * derived rather than awarded. A user who can see that 48 sessions is worth
 * 4,800 points can tell the number is not arbitrary.
 */
export function LevelCard({ level, breakdown, name }: LevelCardProps) {
  const [open, setOpen] = useState(false);
  const tint = levelTint(level.level);

  const body = (
    <>
      <View style={styles.head}>
        <View style={[styles.badge, { borderColor: tint }]}>
          <Text style={styles.badgeLabel}>LVL</Text>
          <Text style={[styles.badgeNumber, { color: tint }]}>{level.level}</Text>
        </View>

        <View style={styles.headText}>
          <Text style={[styles.title, { color: tint }]}>{level.title}</Text>
          <Text style={text.caption}>
            {comma(level.xp)} XP{name ? ` · ${name}` : ''}
          </Text>
        </View>

        {breakdown ? <Text style={styles.chev}>›</Text> : null}
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
    </>
  );

  if (!breakdown) return <View style={styles.card}>{body}</View>;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Level ${level.level}, ${level.title}. See where your XP came from.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {body}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={text.title}>Where your XP came from</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={text.bodyMuted}>
              XP is worked out from your own totals every time this screen opens. Nothing is
              banked, so deleting a set takes its points back with it.
            </Text>

            {breakdown.sources
              .filter((s) => s.xp > 0)
              .sort((a, b) => b.xp - a.xp)
              .map((source) => (
                <View key={source.id} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={text.body}>{source.label}</Text>
                    {source.detail ? <Text style={text.caption}>{source.detail}</Text> : null}
                  </View>
                  <Text style={styles.rowXp}>+{comma(source.xp)}</Text>
                </View>
              ))}

            <View style={[styles.row, styles.totalRow]}>
              <Text style={text.heading}>Total</Text>
              <Text style={[styles.rowXp, styles.totalXp]}>{comma(breakdown.total)} XP</Text>
            </View>

            {breakdown.sources.every((s) => s.xp === 0) ? (
              <Text style={text.bodyMuted}>
                Nothing yet. Finish a workout and this fills in.
              </Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

/** Level bands borrow the trophy palette so the two ladders read as one. */
export function levelTint(level: number): string {
  if (level >= 100) return TIER_COLOR.legend;
  if (level >= 80) return TIER_COLOR.ruby;
  if (level >= 65) return TIER_COLOR.emerald;
  if (level >= 50) return TIER_COLOR.diamond;
  if (level >= 40) return TIER_COLOR.platinum;
  if (level >= 30) return TIER_COLOR.gold;
  if (level >= 20) return TIER_COLOR.silver;
  if (level >= 10) return TIER_COLOR.stone;
  return TIER_COLOR.wood;
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
  cardPressed: { backgroundColor: colors.surfaceRaised },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  badgeLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  badgeNumber: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '800' },
  chev: { color: colors.textFaint, fontSize: 22, fontWeight: '700' },

  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.pill },

  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  sheetBody: { padding: spacing.lg, gap: spacing.xs },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: { gap: 2, flex: 1 },
  rowXp: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  totalRow: { borderTopWidth: 2 },
  totalXp: { color: colors.text },
});
