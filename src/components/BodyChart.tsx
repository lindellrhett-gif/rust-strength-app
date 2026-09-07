import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

import {
  buildBodyChart,
  chartSummary,
  type CoverageLevel,
  type RegionState,
} from '@/domain/bodyChart';
import type { MuscleGroup } from '@/domain/stats';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

/**
 * Front and back figures with each muscle group shaded by how much work it got
 * this week. Drawn rather than illustrated so it matches the trophy icons: same
 * flat shapes, same outline weight, tinted from one small palette.
 */

const LEVEL_FILL: Record<CoverageLevel, string> = {
  none: '#232A33',
  light: '#2F5D8A',
  solid: '#3E86C7',
  heavy: '#4F8CFF',
};

const OUTLINE = '#39424E';

/** Each group's shapes on a 100x210 figure, per side. */
const SHAPES: Record<MuscleGroup, React.ReactNode> = {
  shoulders: (
    <>
      <Ellipse cx="27" cy="58" rx="11" ry="9" />
      <Ellipse cx="73" cy="58" rx="11" ry="9" />
    </>
  ),
  chest: (
    <>
      <Path d="M36 55 H49 V74 Q42 78 34 72 Q33 62 36 55 Z" />
      <Path d="M64 55 H51 V74 Q58 78 66 72 Q67 62 64 55 Z" />
    </>
  ),
  biceps: (
    <>
      <Ellipse cx="22" cy="80" rx="8" ry="13" />
      <Ellipse cx="78" cy="80" rx="8" ry="13" />
    </>
  ),
  core: (
    <>
      <Rect x="38" y="78" width="24" height="30" rx="6" />
    </>
  ),
  quads: (
    <>
      <Path d="M38 116 Q34 140 38 158 L48 158 Q50 136 48 116 Z" />
      <Path d="M62 116 Q66 140 62 158 L52 158 Q50 136 52 116 Z" />
    </>
  ),
  back: (
    <>
      <Path d="M34 56 H66 L62 84 Q50 90 38 84 Z" />
    </>
  ),
  triceps: (
    <>
      <Ellipse cx="22" cy="80" rx="8" ry="13" />
      <Ellipse cx="78" cy="80" rx="8" ry="13" />
    </>
  ),
  glutes: (
    <>
      <Path d="M37 104 Q34 120 42 122 Q50 122 50 106 Z" />
      <Path d="M63 104 Q66 120 58 122 Q50 122 50 106 Z" />
    </>
  ),
  hamstrings: (
    <>
      <Path d="M39 124 Q36 144 40 158 L48 158 Q49 138 48 124 Z" />
      <Path d="M61 124 Q64 144 60 158 L52 158 Q51 138 52 124 Z" />
    </>
  ),
  calves: (
    <>
      <Ellipse cx="43" cy="176" rx="7" ry="14" />
      <Ellipse cx="57" cy="176" rx="7" ry="14" />
    </>
  ),
};

/** The neutral body outline both figures share. */
function Silhouette() {
  return (
    <G stroke={OUTLINE} strokeWidth={1.5} fill="#1A2029">
      <Ellipse cx="50" cy="20" rx="13" ry="15" />
      <Path d="M50 35 V44" />
      <Path d="M30 52 Q50 44 70 52 L68 110 Q50 116 32 110 Z" />
      <Path d="M30 54 Q18 62 16 96 L26 100 Q30 74 34 62 Z" />
      <Path d="M70 54 Q82 62 84 96 L74 100 Q70 74 66 62 Z" />
      <Path d="M34 110 Q32 150 38 196 L48 196 Q50 150 50 112 Z" />
      <Path d="M66 110 Q68 150 62 196 L52 196 Q50 150 50 112 Z" />
    </G>
  );
}

function Figure({
  regions,
  side,
}: {
  regions: RegionState[];
  side: 'front' | 'back';
}) {
  const shown = regions.filter((r) => r.side === side);
  return (
    <View style={styles.figure}>
      <Svg width={104} height={214} viewBox="0 0 100 210">
        <Silhouette />
        {shown.map((r) => (
          <G
            key={r.group}
            fill={LEVEL_FILL[r.level]}
            stroke={OUTLINE}
            strokeWidth={1}
            opacity={r.level === 'none' ? 0.85 : 1}
          >
            {SHAPES[r.group]}
          </G>
        ))}
      </Svg>
      <Text style={styles.figureLabel}>{side === 'front' ? 'FRONT' : 'BACK'}</Text>
    </View>
  );
}

export function BodyChart({
  weekCoverage,
}: {
  weekCoverage: Partial<Record<MuscleGroup, number>>;
}) {
  const regions = buildBodyChart(weekCoverage);
  const summary = chartSummary(regions);

  return (
    <View style={styles.wrap}>
      <View style={styles.figures}>
        <Figure regions={regions} side="front" />
        <Figure regions={regions} side="back" />

        <View style={styles.legend}>
          <Text style={text.label}>THIS WEEK</Text>
          <Text style={styles.count}>
            {summary.trained}
            <Text style={styles.countTotal}>/{summary.total}</Text>
          </Text>
          <Text style={text.caption}>muscle groups</Text>

          <View style={styles.legendKeys}>
            {(
              [
                ['none', 'Not yet'],
                ['light', '1–3 sets'],
                ['solid', '4–8 sets'],
                ['heavy', '9+ sets'],
              ] as [CoverageLevel, string][]
            ).map(([level, label]) => (
              <View key={level} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: LEVEL_FILL[level] }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Text style={[text.caption, styles.headline]}>{summary.headline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  figures: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  figure: { alignItems: 'center', gap: 2 },
  figureLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  legend: { flex: 1, paddingLeft: spacing.xs, gap: 2 },
  count: { color: colors.text, fontSize: 30, fontWeight: '800' },
  countTotal: { color: colors.textFaint, fontSize: 18, fontWeight: '700' },
  legendKeys: { marginTop: spacing.sm, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.textMuted, fontSize: 11 },
  headline: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    borderRadius: radius.sm,
  },
});
