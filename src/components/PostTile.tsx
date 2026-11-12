import { Pressable, StyleSheet, Text, View } from 'react-native';

import { POSTER_TEXT_SCALE, POSTER_TONE } from './PostPoster';
import { GlyphIcon } from './TrophyIcon';
import type { FeedPost } from '@/domain/feed';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

/** One session in the grid on a friend's profile. Tapping it opens the full post. */
export function PostTile({
  post,
  size,
  onPress,
}: {
  post: FeedPost;
  size: number;
  onPress: () => void;
}) {
  const { tone, title, hero, tile } = post.poster;
  const { background, ink, glyph } = POSTER_TONE[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size, backgroundColor: background },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${hero}. Open this session.`}
    >
      <View style={styles.mark} pointerEvents="none">
        <GlyphIcon glyph={glyph} color={`${ink}40`} size={26} />
      </View>
      <Text
        style={[styles.value, { color: ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={POSTER_TEXT_SCALE}
      >
        {tile.value}
      </Text>
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={POSTER_TEXT_SCALE}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { justifyContent: 'flex-end', padding: spacing.sm, overflow: 'hidden' },
  pressed: { opacity: 0.75 },
  mark: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  value: { fontSize: 18, fontWeight: '800' },
  label: { color: colors.posterTitle, fontSize: 12, fontWeight: '600' },
});
