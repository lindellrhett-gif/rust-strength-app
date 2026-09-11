import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import {
  buildChartGeometry,
  nearestIndex,
  shortDate,
  type ChartPadding,
  type ProgressSeries,
} from '@/domain/progress';
import { trimWeight } from '@/lib/format';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

/** Plot box, plus a band at the bottom that the date labels live in. */
const PLOT_HEIGHT = 168;
const AXIS_BAND = 22;
const HEIGHT = PLOT_HEIGHT + AXIS_BAND;

const PADDING: ChartPadding = { top: 14, right: 14, bottom: AXIS_BAND, left: 42 };

interface ProgressChartProps {
  series: ProgressSeries;
  unit: string;
  /** Names the single series, so no legend box is needed. */
  label: string;
}

/**
 * One exercise, one measure, over time.
 *
 * Deliberately a single series on a single axis. Two measures with different
 * scales on shared axes invents a correlation that is not in the data, so the
 * screen switches between measures rather than stacking them.
 *
 * The value is always readable without touching anything — the latest figure
 * sits above the chart and the endpoint is labelled — so the scrub readout adds
 * detail rather than being the only way to read the numbers.
 */
export function ProgressChart({ series, unit, label }: ProgressChartProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const geometry = buildChartGeometry(series, width, HEIGHT, PADDING);
  const active = activeIndex != null ? geometry.plotted[activeIndex] : null;
  const last = geometry.plotted[geometry.plotted.length - 1] ?? null;
  const shown = active ?? last;

  const scrub = (event: GestureResponderEvent) => {
    const index = nearestIndex(geometry, event.nativeEvent.locationX);
    if (index >= 0) setActiveIndex(index);
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (series.points.length === 0) {
    return (
      <View style={styles.wrap} onLayout={onLayout}>
        <Text style={text.bodyMuted}>
          No working sets logged for this exercise yet. Log one and the chart fills in.
        </Text>
      </View>
    );
  }

  // The peak only gets its own label when it is not already the endpoint,
  // so the chart never prints two labels on the same dot.
  const peak =
    series.bestIndex >= 0 && series.bestIndex !== geometry.plotted.length - 1
      ? geometry.plotted[series.bestIndex]
      : null;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {/* Fixed height so scrubbing never shifts the chart below it. */}
      <View style={styles.readout}>
        <View>
          <Text style={styles.value}>
            {trimWeight(shown?.point.value ?? 0)} <Text style={styles.unit}>{unit}</Text>
          </Text>
          <Text style={text.caption}>
            {shown ? `${label} · ${shortDate(shown.point.date)}` : label}
          </Text>
        </View>
        {shown ? (
          <View style={styles.readoutRight}>
            <Text style={text.caption}>
              {shown.point.sets} set{shown.point.sets === 1 ? '' : 's'}
            </Text>
            <Text style={text.caption}>
              top {trimWeight(shown.point.topWeight)} × {shown.point.topReps}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{ height: HEIGHT }}
        // The whole plot is the hit area, so nobody has to land on a dot.
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        onResponderRelease={() => setActiveIndex(null)}
        onResponderTerminate={() => setActiveIndex(null)}
        accessibilityRole="image"
        accessibilityLabel={`${label} over ${series.points.length} sessions. Latest ${trimWeight(
          series.latest ?? 0,
        )} ${unit}. Best ${trimWeight(series.best ?? 0)} ${unit}.`}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {/* Solid hairlines one shade off the surface — a grid, not a signal. */}
            {geometry.gridLines.map((line) => (
              <Line
                key={`grid-${line.value}`}
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={line.y}
                y2={line.y}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {geometry.gridLines.map((line) => (
              <SvgText
                key={`tick-${line.value}`}
                x={PADDING.left - 8}
                y={line.y + 4}
                fill={colors.textFaint}
                fontSize={10}
                textAnchor="end"
              >
                {trimWeight(line.value)}
              </SvgText>
            ))}

            {geometry.areaPath ? (
              <Path d={geometry.areaPath} fill={colors.primary} opacity={0.12} />
            ) : null}
            <Path
              d={geometry.path}
              stroke={colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Crosshair while scrubbing. */}
            {active ? (
              <Line
                x1={active.x}
                x2={active.x}
                y1={PADDING.top}
                y2={geometry.baselineY}
                stroke={colors.textFaint}
                strokeWidth={1}
              />
            ) : null}

            {/* Only the endpoint and the peak carry a marker; a dot on every
                session turns a 40-workout history into a smear. */}
            {[peak, last].filter(Boolean).map((p) => (
              <Circle
                key={`marker-${p!.index}`}
                cx={p!.x}
                cy={p!.y}
                r={4}
                fill={colors.primary}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ))}
            {active ? (
              <Circle
                cx={active.x}
                cy={active.y}
                r={5}
                fill={colors.primary}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ) : null}

            {peak ? (
              <SvgText
                x={peak.x}
                y={peak.y - 10}
                fill={colors.textMuted}
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                best
              </SvgText>
            ) : null}

            {/* First and last dates only — enough to place the line in time. */}
            {geometry.plotted.length > 0 ? (
              <SvgText
                x={PADDING.left}
                y={HEIGHT - 6}
                fill={colors.textFaint}
                fontSize={10}
                textAnchor="start"
              >
                {shortDate(geometry.plotted[0].point.date)}
              </SvgText>
            ) : null}
            {geometry.plotted.length > 1 ? (
              <SvgText
                x={width - PADDING.right}
                y={HEIGHT - 6}
                fill={colors.textFaint}
                fontSize={10}
                textAnchor="end"
              >
                {shortDate(geometry.plotted[geometry.plotted.length - 1].point.date)}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>

      <Text style={text.caption}>Touch and drag across the chart to read a session.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  readout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 48,
  },
  readoutRight: { alignItems: 'flex-end', gap: 1 },
  // Proportional figures, not tabular — equal-width digits read loose this big.
  value: { color: colors.text, fontSize: 30, fontWeight: '800' },
  unit: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
});
