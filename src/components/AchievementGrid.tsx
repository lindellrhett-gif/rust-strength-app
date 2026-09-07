import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TrophyIcon } from './TrophyIcon';
import { TIER_COLOR, TIER_LABEL, type TieredAchievement } from '@/domain/achievements';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export function AchievementGrid({ achievements }: { achievements: TieredAchievement[] }) {
  const [open, setOpen] = useState<TieredAchievement | null>(null);

  return (
    <>
      <View style={styles.grid}>
        {achievements.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setOpen(a)}
            style={({ pressed }) => [
              styles.tile,
              a.tier ? { borderColor: TIER_COLOR[a.tier] } : styles.locked,
              pressed && styles.tilePressed,
            ]}
          >
            <TrophyIcon glyph={a.glyph} tier={a.tier} size={46} />

            <Text style={styles.name} numberOfLines={1}>
              {a.name}
            </Text>

            <Text
              style={[styles.tierLabel, a.tier ? { color: TIER_COLOR[a.tier] } : null]}
              numberOfLines={1}
            >
              {a.tier ? TIER_LABEL[a.tier] : 'Locked'}
            </Text>

            {/* Nine pips: a glance-able read of how far up the ladder you are. */}
            <View style={styles.pips}>
              {a.steps.map((s) => (
                <View
                  key={s.tier}
                  style={[styles.pip, s.earned ? { backgroundColor: TIER_COLOR[s.tier] } : null]}
                />
              ))}
            </View>

            <Text style={styles.value} numberOfLines={1}>
              {a.valueLabel}
            </Text>

            {a.next ? (
              <Text style={styles.next} numberOfLines={1}>
                {a.next.label} for {TIER_LABEL[a.next.tier]}
              </Text>
            ) : (
              <Text style={[styles.next, styles.maxed]}>Maxed out</Text>
            )}
          </Pressable>
        ))}
      </View>

      <TrophyDetail achievement={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Full nine-rung ladder for one trophy. */
function TrophyDetail({
  achievement: a,
  onClose,
}: {
  achievement: TieredAchievement | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!a} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet}>
          {a ? (
            <>
              <View style={styles.detailHead}>
                <TrophyIcon glyph={a.glyph} tier={a.tier} size={58} />
                <View style={styles.detailTitle}>
                  <Text style={text.heading}>{a.name}</Text>
                  <Text style={text.caption}>
                    {a.tier ? TIER_LABEL[a.tier] : 'Not started'} · {a.tiersEarned} of{' '}
                    {a.tiersTotal} tiers
                  </Text>
                  <Text style={text.bodyMuted}>Best: {a.valueLabel}</Text>
                </View>
              </View>

              <ScrollView style={styles.ladder} contentContainerStyle={styles.ladderInner}>
                {a.steps.map((s) => (
                  <View key={s.tier} style={styles.rung}>
                    <View
                      style={[
                        styles.rungDot,
                        s.earned
                          ? {
                              backgroundColor: TIER_COLOR[s.tier],
                              borderColor: TIER_COLOR[s.tier],
                            }
                          : null,
                      ]}
                    />
                    <View style={styles.rungText}>
                      <Text
                        style={[styles.rungTier, s.earned ? { color: TIER_COLOR[s.tier] } : null]}
                      >
                        {TIER_LABEL[s.tier]}
                      </Text>
                      {s.note ? <Text style={styles.rungNote}>{s.note}</Text> : null}
                    </View>
                    <Text style={[styles.rungValue, s.earned && styles.rungValueOn]}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <Pressable onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Compact read-only strip for a friend's profile: earned trophies only. */
export function AchievementStrip({ achievements }: { achievements: TieredAchievement[] }) {
  const earned = achievements.filter((a) => a.earned);
  if (earned.length === 0) {
    return <Text style={text.bodyMuted}>No trophies yet.</Text>;
  }
  return (
    <View style={styles.strip}>
      {earned.map((a) => (
        <View key={a.id} style={styles.stripItem}>
          <TrophyIcon glyph={a.glyph} tier={a.tier} size={38} />
          <Text style={styles.stripName} numberOfLines={1}>
            {a.name}
          </Text>
          <Text
            style={[styles.stripTier, a.tier ? { color: TIER_COLOR[a.tier] } : null]}
            numberOfLines={1}
          >
            {a.tier ? TIER_LABEL[a.tier] : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  tilePressed: { backgroundColor: colors.border },
  locked: { opacity: 0.6 },
  name: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  tierLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  pips: { flexDirection: 'row', gap: 3, marginVertical: 4 },
  pip: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  value: { color: colors.text, fontSize: 13, fontWeight: '700' },
  next: { color: colors.textFaint, fontSize: 10, fontWeight: '600' },
  maxed: { color: colors.success },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  detailTitle: { gap: 2, flexShrink: 1 },
  ladder: { marginTop: spacing.lg },
  ladderInner: { gap: spacing.xs },
  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rungDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  rungText: { flex: 1 },
  rungTier: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  rungNote: { color: colors.textFaint, fontSize: 11 },
  rungValue: { color: colors.textFaint, fontSize: 14, fontWeight: '700' },
  rungValueOn: { color: colors.text },
  close: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.text, fontWeight: '700', fontSize: 15 },

  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stripItem: { alignItems: 'center', width: 76, gap: 1 },
  stripName: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  stripTier: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
});
