import type { ReactNode, Ref } from 'react';
import { StyleSheet, Text, View, type TextProps } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CARD_SIZE, type CardStat } from '@/domain/shareCard';

/**
 * The share cards' own palette: the app's near-black ground with the rust
 * and steel of the app icon (scripts/make-icons.js), and gold for records.
 */
export const cardColors = {
  ground: '#0B0D10',
  groundWarm: '#24120A',
  rust: '#B7521E',
  rustLight: '#D96F32',
  steel: '#C7D2DC',
  gold: '#F5B14C',
  text: '#F2F5F8',
  muted: '#9AA7B4',
  faint: '#5E6B78',
  line: 'rgba(255,255,255,0.09)',
  panel: 'rgba(255,255,255,0.045)',
} as const;

/**
 * Text on a card. The card is a fixed-size image, so it ignores the phone's
 * text size setting: a larger size would push content off the edge of the
 * picture rather than make it easier to read.
 */
export function CardText(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}

/** The app icon's barbell, drawn to the same proportions. */
export function BrandMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={6} y={45.75} width={88} height={8.5} rx={4.25} fill={cardColors.steel} />
      <Rect x={15} y={19} width={13} height={62} rx={3} fill={cardColors.rust} />
      <Rect x={30.5} y={28} width={9.5} height={44} rx={3} fill={cardColors.rustLight} />
      <Rect x={72} y={19} width={13} height={62} rx={3} fill={cardColors.rust} />
      <Rect x={60} y={28} width={9.5} height={44} rx={3} fill={cardColors.rustLight} />
      <Rect x={28.3} y={37} width={1.9} height={26} rx={0.9} fill={cardColors.steel} />
      <Rect x={69.8} y={37} width={1.9} height={26} rx={0.9} fill={cardColors.steel} />
    </Svg>
  );
}

/**
 * A card's ground, top line and Rust Strength sign-off. Fixed at
 * CARD_SIZE points and exported at three times that (1080 x 1920).
 */
export function CardFrame({
  kicker,
  topRight,
  children,
  ref,
}: {
  kicker: string;
  topRight: string;
  children: ReactNode;
  ref?: Ref<View>;
}) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Svg style={StyleSheet.absoluteFill} width={CARD_SIZE.width} height={CARD_SIZE.height}>
        <Defs>
          <LinearGradient id="ground" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={cardColors.groundWarm} />
            <Stop offset="0.55" stopColor={cardColors.ground} />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.85" cy="0.08" r="0.6">
            <Stop offset="0" stopColor={cardColors.rustLight} stopOpacity={0.28} />
            <Stop offset="1" stopColor={cardColors.rustLight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={CARD_SIZE.width} height={CARD_SIZE.height} fill="url(#ground)" />
        <Circle cx={CARD_SIZE.width * 0.85} cy={CARD_SIZE.height * 0.08} r={CARD_SIZE.height * 0.6} fill="url(#glow)" />
      </Svg>

      <View style={styles.top}>
        <CardText style={styles.kicker}>{kicker}</CardText>
        <CardText style={styles.topRight} numberOfLines={1}>
          {topRight}
        </CardText>
      </View>

      <View style={styles.body}>{children}</View>

      <View style={styles.promo}>
        <BrandMark size={30} />
        <View style={styles.promoText}>
          <CardText style={styles.wordmark}>RUST STRENGTH</CardText>
          <CardText style={styles.tagline}>Track every lift and run · Available on the App Store</CardText>
        </View>
      </View>
    </View>
  );
}

/** Two to four numbers side by side, each in its own panel. */
export function StatRow({ stats }: { stats: readonly CardStat[] }) {
  return (
    <View style={styles.stats}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat}>
          <CardText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {s.value}
          </CardText>
          <CardText style={styles.statLabel} numberOfLines={1}>
            {s.label.toUpperCase()}
          </CardText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    backgroundColor: cardColors.ground,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { color: cardColors.rustLight, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  topRight: { color: cardColors.muted, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  body: { flex: 1, marginTop: 14, gap: 14 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: cardColors.line,
  },
  promoText: { flex: 1, gap: 2 },
  wordmark: { color: cardColors.text, fontSize: 13, fontWeight: '900', letterSpacing: 2.5 },
  tagline: { color: cardColors.muted, fontSize: 10, fontWeight: '500' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: cardColors.panel,
    borderWidth: 1,
    borderColor: cardColors.line,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 2,
  },
  statValue: { color: cardColors.text, fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: cardColors.muted, fontSize: 9.5, fontWeight: '700', letterSpacing: 1 },
});
