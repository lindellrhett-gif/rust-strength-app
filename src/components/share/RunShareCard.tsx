import { useState, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BrandMark, CardFrame, CardText, StatRow, cardColors } from './cardParts';
import { outlinePath } from '@/domain/running/display';
import type { LatLon } from '@/domain/running/geo';
import type { RunCard } from '@/domain/shareCard';

/** The trimmed route as a glowing line, filling whatever space is left. */
function RouteArt({ points }: { points: readonly LatLon[] }) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const path = box ? outlinePath(points, box.width, box.height, 18) : null;

  return (
    <View style={styles.art} onLayout={onLayout}>
      {box && path ? (
        <Svg width={box.width} height={box.height}>
          <Path d={path} stroke={cardColors.rustLight} strokeOpacity={0.18} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={path} stroke={cardColors.rustLight} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={path} stroke="#FFD9BF" strokeOpacity={0.7} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** The card shared after a run: distance, pace, splits and the route's shape. */
export function RunShareCard({ card, ref }: { card: RunCard; ref?: Ref<View> }) {
  const hasRoute = card.outline.length > 1;

  return (
    <CardFrame ref={ref} kicker="RUN" topRight={card.subtitle}>
      <CardText style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
        {card.title}
      </CardText>

      {hasRoute ? (
        <RouteArt points={card.outline} />
      ) : (
        // No route to draw (a treadmill run, or one kept private): the mark
        // fills the space, faintly, and the numbers carry the card.
        <View style={[styles.art, styles.noRoute]}>
          <View style={styles.watermark}>
            <BrandMark size={200} />
          </View>
        </View>
      )}

      <View style={styles.distanceRow}>
        <CardText style={styles.distance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {card.distance}
        </CardText>
        <CardText style={styles.distanceUnit}>{card.distanceUnit}</CardText>
      </View>

      <StatRow stats={card.stats} />

      {card.bars.length > 0 ? (
        <View style={styles.splits}>
          <CardText style={styles.sectionLabel}>SPLITS</CardText>
          <View style={styles.bars}>
            {card.bars.map((b, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { height: `${Math.round(b.height * 100)}%` },
                  b.fastest ? styles.barFastest : null,
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {card.highlights.length > 0 || card.longest ? (
        <View style={styles.chips}>
          {card.longest ? (
            <View style={[styles.chip, styles.chipGold]}>
              <CardText style={[styles.chipText, styles.chipTextGold]}>LONGEST RUN YET</CardText>
            </View>
          ) : null}
          {card.highlights.map((h) => (
            <View key={h.label} style={[styles.chip, h.isRecord && styles.chipGold]}>
              <CardText style={[styles.chipText, h.isRecord && styles.chipTextGold]}>
                {h.label} {h.value}
                {h.isRecord ? '  PR' : ''}
              </CardText>
            </View>
          ))}
        </View>
      ) : null}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  title: { color: cardColors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  art: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: cardColors.panel,
    borderWidth: 1,
    borderColor: cardColors.line,
    overflow: 'hidden',
  },
  noRoute: { alignItems: 'center', justifyContent: 'center' },
  watermark: { opacity: 0.08 },
  distanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: -2 },
  distance: {
    color: cardColors.text,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  distanceUnit: { color: cardColors.muted, fontSize: 16, fontWeight: '700' },
  splits: { gap: 6 },
  sectionLabel: { color: cardColors.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
  bars: { height: 40, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { flex: 1, borderRadius: 2, backgroundColor: cardColors.rust },
  barFastest: { backgroundColor: cardColors.gold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: cardColors.line,
    backgroundColor: cardColors.panel,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipGold: { borderColor: 'rgba(245,177,76,0.55)', backgroundColor: 'rgba(245,177,76,0.1)' },
  chipText: { color: cardColors.text, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chipTextGold: { color: cardColors.gold },
});
