import { StyleSheet, View } from 'react-native';

import { TrophyIcon } from './TrophyIcon';
import { TIER_LABEL, parseFeatured } from '@/domain/achievements';

/**
 * The one or two trophies someone chose to show by their name, as small
 * medals. Renders nothing when there are none.
 */
/** What the medals say to VoiceOver, for a parent that speaks for its children. */
export function featuredTrophiesLabel(keys: readonly string[] | null | undefined): string | null {
  const trophies = parseFeatured(keys);
  if (trophies.length === 0) return null;
  return `Shows ${trophies.map((t) => `${t.name}, ${TIER_LABEL[t.tier]}`).join(' and ')}`;
}

export function FeaturedTrophies({ keys, size = 20 }: { keys: readonly string[] | null | undefined; size?: number }) {
  const trophies = parseFeatured(keys);
  if (trophies.length === 0) return null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={featuredTrophiesLabel(keys) ?? undefined}
    >
      {trophies.map((t) => (
        <TrophyIcon key={t.id} glyph={t.glyph} tier={t.tier} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
