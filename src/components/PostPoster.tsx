import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GlyphIcon } from './TrophyIcon';
import type { TrophyGlyph } from '@/domain/achievements';
import { REACTIONS, type FeedPost, type PosterTone } from '@/domain/feed';
import { outlinePath } from '@/domain/running/display';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

/** A dark tint and its bright ink for each kind of session. */
export const POSTER_TONE: Record<PosterTone, { background: string; ink: string; glyph: TrophyGlyph }> = {
  record: { background: colors.posterRecord, ink: colors.posterRecordInk, glyph: 'crown' },
  lift: { background: colors.posterLift, ink: colors.posterLiftInk, glyph: 'deadlift' },
  run: { background: colors.posterRun, ink: colors.posterRunInk, glyph: 'shoe' },
  activity: { background: colors.posterActivity, ink: colors.posterActivityInk, glyph: 'bolt' },
};

/** The poster is a fixed shape, so its words can't grow as far as elsewhere. */
export const POSTER_TEXT_SCALE = 1.3;

const DOUBLE_TAP_MS = 300;
const ROUTE_SHARE = 0.62;

const FIRE = REACTIONS.find((r) => r.id === 'fire')!;

/**
 * The big graphic at the heart of a post, made from the session's own summary.
 * No photos: nothing here goes beyond what friends could already see, and a
 * shared run's outline has already been trimmed on the server.
 *
 * Double-tapping it reacts, when `onDoubleTap` is given. VoiceOver users have
 * the reaction buttons under it, since a double tap there means something else.
 */
export function PostPoster({ post, onDoubleTap }: { post: FeedPost; onDoubleTap?: () => void }) {
  const { tone, eyebrow, title, hero, details } = post.poster;
  const { background, ink, glyph } = POSTER_TONE[tone];

  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((was) => (was?.width === width && was.height === height ? was : { width, height }));
  };

  const route =
    post.route && box ? outlinePath(post.route, box.width, box.height * ROUTE_SHARE, 24) : null;

  const lastTap = useRef(0);
  const [burst] = useState(() => new Animated.Value(0));
  const onPress = () => {
    if (!onDoubleTap) return;
    const now = Date.now();
    if (now - lastTap.current > DOUBLE_TAP_MS) {
      lastTap.current = now;
      return;
    }
    lastTap.current = 0;
    onDoubleTap();
    burst.setValue(0);
    Animated.timing(burst, { toValue: 1, duration: 650, useNativeDriver: true }).start();
  };

  const label = [eyebrow, title, hero, ...details, route ? 'with the outline of the route' : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={[styles.poster, { backgroundColor: background }]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {route ? (
        <View style={styles.route} pointerEvents="none">
          <Svg width={box!.width} height={box!.height * ROUTE_SHARE}>
            <Path
              d={route}
              stroke={ink}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : (
        <View style={styles.watermark} pointerEvents="none">
          <GlyphIcon glyph={glyph} color={`${ink}40`} size={72} />
        </View>
      )}

      <View style={styles.top}>
        {eyebrow ? (
          <>
            {tone === 'record' ? <Ionicons name="trophy" size={16} color={ink} /> : null}
            <Text style={[styles.eyebrow, { color: ink }]} numberOfLines={1} maxFontSizeMultiplier={POSTER_TEXT_SCALE}>
              {eyebrow}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={POSTER_TEXT_SCALE}>
          {title}
        </Text>
        <Text
          style={[styles.hero, { color: ink }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={POSTER_TEXT_SCALE}
        >
          {hero}
        </Text>
        {details.length > 0 ? (
          <View style={styles.details}>
            {details.map((d) => (
              <Text key={d} style={styles.detail} numberOfLines={1} maxFontSizeMultiplier={POSTER_TEXT_SCALE}>
                {d}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          {
            opacity: burst.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { scale: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.15, 1] }) },
            ],
          },
        ]}
      >
        <GlyphIcon glyph={FIRE.glyph} color={FIRE.color} size={96} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: '100%',
    aspectRatio: 1.45,
    padding: spacing.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  route: { position: 'absolute', top: 0, left: 0, right: 0 },
  watermark: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 20 },
  eyebrow: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  bottom: { gap: 2 },
  title: { color: colors.posterTitle, fontSize: 16, fontWeight: '700' },
  hero: { fontSize: 42, fontWeight: '800', lineHeight: 48 },
  details: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, marginTop: 2 },
  detail: { color: colors.posterTitle, fontSize: 13, fontWeight: '600' },
  burst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
