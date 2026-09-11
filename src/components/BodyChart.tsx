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
 *
 * The figure is laid out on the standard eight-head canon, which is what stops
 * it reading as a cartoon. On a 212-unit figure that fixes every landmark:
 *
 *   crown 4 · chin 30 (one head = 26) · shoulders 44 · waist 84
 *   hips 106 (exactly half) · knee 157 · ankle 200
 *
 * Widths follow from the same canon — shoulders about two and a half head
 * widths, waist narrower than the hips. Every muscle shape below is positioned
 * against those numbers rather than eyeballed, so the pecs sit on the chest and
 * the calves sit below the knee.
 */

const LEVEL_FILL: Record<CoverageLevel, string> = {
  none: '#232A33',
  light: '#2F5D8A',
  solid: '#3E86C7',
  heavy: '#4F8CFF',
};

const OUTLINE = '#39424E';
const BODY_FILL = '#1A2029';

/** Each group's shapes, positioned on the landmarks above. */
const SHAPES: Record<MuscleGroup, React.ReactNode> = {
  // --- Front ---------------------------------------------------------------
  shoulders: (
    <>
      <Ellipse cx="29" cy="52" rx="8" ry="8" />
      <Ellipse cx="71" cy="52" rx="8" ry="8" />
    </>
  ),
  chest: (
    <>
      <Path d="M36 52 Q44 49 49 51 L49 72 Q40 75 35 68 Q34 58 36 52 Z" />
      <Path d="M64 52 Q56 49 51 51 L51 72 Q60 75 65 68 Q66 58 64 52 Z" />
    </>
  ),
  biceps: (
    <>
      <Ellipse cx="25" cy="64" rx="4.5" ry="11" />
      <Ellipse cx="75" cy="64" rx="4.5" ry="11" />
    </>
  ),
  core: <Rect x="41" y="74" width="18" height="28" rx="5" />,
  quads: (
    <>
      <Path d="M34 110 Q31 130 35 152 L46 152 Q47 130 47 110 Z" />
      <Path d="M66 110 Q69 130 65 152 L54 152 Q53 130 53 110 Z" />
    </>
  ),

  // --- Back ----------------------------------------------------------------
  back: <Path d="M32 46 Q50 41 68 46 L65 68 L63 86 Q50 91 37 86 L35 68 Z" />,
  triceps: (
    <>
      <Ellipse cx="25" cy="64" rx="4.5" ry="11" />
      <Ellipse cx="75" cy="64" rx="4.5" ry="11" />
    </>
  ),
  glutes: (
    <>
      <Ellipse cx="41" cy="107" rx="9" ry="11" />
      <Ellipse cx="59" cy="107" rx="9" ry="11" />
    </>
  ),
  hamstrings: (
    <>
      <Path d="M34 116 Q32 134 35 154 L46 154 Q47 134 47 116 Z" />
      <Path d="M66 116 Q68 134 65 154 L54 154 Q53 134 53 116 Z" />
    </>
  ),
  calves: (
    <>
      <Ellipse cx="41" cy="174" rx="6.5" ry="14" />
      <Ellipse cx="59" cy="174" rx="6.5" ry="14" />
    </>
  ),
};

/**
 * The neutral body both figures share.
 *
 * The neck is drawn before the torso so the torso covers its base, and the
 * arms hang to mid-thigh — a wrist at hip height is the landmark that makes
 * arms read as the right length.
 */
function Silhouette() {
  return (
    <G stroke={OUTLINE} strokeWidth={1.5} fill={BODY_FILL} strokeLinejoin="round">
      <Ellipse cx="50" cy="17" rx="8.5" ry="12.5" />
      <Path d="M46 27 L46 44 L54 44 L54 27 Z" />

      {/* Shoulders 46 wide, tapering to a 32-wide waist, out again at the hips. */}
      <Path d="M27 45 Q50 33 73 45 L69 70 L66 84 L69 106 Q50 112 31 106 L34 84 L31 70 Z" />

      <Path d="M28 47 Q21 53 20 74 L19 104 L27 105 L27 75 Q28 59 33 51 Z" />
      <Path d="M72 47 Q79 53 80 74 L81 104 L73 105 L73 75 Q72 59 67 51 Z" />
      <Ellipse cx="22" cy="112" rx="4.5" ry="7" />
      <Ellipse cx="78" cy="112" rx="4.5" ry="7" />

      {/* Legs are half the figure: hip 106 to ankle 200, knee at 157. */}
      <Path d="M32 106 Q29 132 34 157 Q36 180 37 200 L46 200 Q47 176 47 157 Q48 132 49 108 Z" />
      <Path d="M68 106 Q71 132 66 157 Q64 180 63 200 L54 200 Q53 176 53 157 Q52 132 51 108 Z" />
      <Path d="M36 200 L46 200 L46 207 L33 207 Z" />
      <Path d="M64 200 L54 200 L54 207 L67 207 Z" />
    </G>
  );
}

function Figure({ regions, side }: { regions: RegionState[]; side: 'front' | 'back' }) {
  const shown = regions.filter((r) => r.side === side);
  return (
    <View style={styles.figure}>
      <Svg width={98} height={208} viewBox="0 0 100 212">
        <Silhouette />
        {shown.map((r) => (
          <G
            key={r.group}
            fill={LEVEL_FILL[r.level]}
            stroke={OUTLINE}
            strokeWidth={1}
            strokeLinejoin="round"
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
