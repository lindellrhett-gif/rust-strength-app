import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { chartRange, type ChartPoint } from '@/domain/running/charts';
import { formatClock } from '@/domain/duration';
import { formatElevation, formatPace, type RunDistanceUnit } from '@/domain/running/units';
import { colors } from '@/theme/colors';
import { spacing, text } from '@/theme/typography';

const PLOT_HEIGHT = 120;
const AXIS_BAND = 20;
const LEFT = 62;
const RIGHT = 8;
const TOP = 10;

interface RunChartProps {
  points: ChartPoint[];
  kind: 'pace' | 'elevation';
  unit: RunDistanceUnit;
  title: string;
}

/**
 * Pace or elevation along a run, against distance. Pace is drawn with faster
 * at the top, the way runners read it. VoiceOver reads a one-line summary
 * (the range) rather than a hundred points.
 */
export function RunChart({ points, kind, unit, title }: RunChartProps) {
  const [width, setWidth] = useState(0);
  const range = chartRange(points);
  if (!range || points.length < 2) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const format = (y: number) => (kind === 'pace' ? formatPace(y, unit) : formatElevation(y, unit));

  // A little headroom, and never a span so small that GPS wobble looks dramatic.
  const minSpan = kind === 'pace' ? 30 : 10;
  const span = Math.max(range.max - range.min, minSpan);
  const mid = (range.max + range.min) / 2;
  const lo = mid - span * 0.55;
  const hi = mid + span * 0.55;
  const xMax = points[points.length - 1].x;
  const plotW = Math.max(1, width - LEFT - RIGHT);

  const px = (x: number) => LEFT + (x / (xMax || 1)) * plotW;
  // Pace: smaller is faster and goes to the top. Elevation: higher goes to the top.
  const py = (y: number) => {
    const f = (y - lo) / (hi - lo);
    return TOP + (kind === 'pace' ? f : 1 - f) * PLOT_HEIGHT;
  };

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join('');
  const floor = TOP + PLOT_HEIGHT;
  const area = `${line}L${px(xMax).toFixed(1)},${floor}L${px(points[0].x).toFixed(1)},${floor}Z`;
  const stroke = kind === 'pace' ? colors.primary : colors.warning;

  const topLabel = kind === 'pace' ? format(range.min) : format(range.max);
  const bottomLabel = kind === 'pace' ? format(range.max) : format(range.min);
  const per = unit === 'mi' ? 'mile' : 'kilometre';
  const clock = (y: number) => formatClock(Math.round(y));
  const spoken =
    kind === 'pace'
      ? `${title}: fastest ${clock(range.min)}, slowest ${clock(range.max)} per ${per}`
      : `${title}: from ${format(range.min)} to ${format(range.max)}`;

  return (
    <View style={styles.wrap}>
      <Text style={[text.label, styles.title]}>{title.toUpperCase()}</Text>
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={spoken}>
        {width > 0 ? (
          <Svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND}>
            <Line x1={LEFT} x2={width - RIGHT} y1={TOP} y2={TOP} stroke={colors.border} strokeWidth={1} />
            <Line x1={LEFT} x2={width - RIGHT} y1={floor} y2={floor} stroke={colors.border} strokeWidth={1} />
            <Path d={area} fill={stroke} fillOpacity={0.12} />
            <Path d={line} stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <SvgText x={LEFT - 6} y={TOP + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {topLabel}
            </SvgText>
            <SvgText x={LEFT - 6} y={floor} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {bottomLabel}
            </SvgText>
            <SvgText x={LEFT} y={floor + 15} fontSize={11} fill={colors.textMuted}>
              0
            </SvgText>
            <SvgText x={width - RIGHT} y={floor + 15} fontSize={11} fill={colors.textMuted} textAnchor="end">
              {`${xMax.toFixed(xMax < 10 ? 2 : 1)} ${unit}`}
            </SvgText>
          </Svg>
        ) : (
          <View style={{ height: TOP + PLOT_HEIGHT + AXIS_BAND }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { marginBottom: spacing.xs },
});
