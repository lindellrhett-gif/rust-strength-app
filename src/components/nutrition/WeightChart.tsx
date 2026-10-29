import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { weightIn, type TrendPoint, type WeightUnit } from '@/domain/nutrition/body';
import { dayLabel } from '@/domain/nutrition/diary';
import { colors } from '@/theme/colors';

const PLOT_HEIGHT = 150;
const TOP = 12;
const AXIS_BAND = 20;
const LEFT = 40;
const RIGHT = 8;

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Weigh-ins as dots and the smoothed trend as a line, over real dates (a
 * week without weighing leaves a gap the width of a week). The goal weight,
 * when it is in view or near it, is a dashed line.
 */
export function WeightChart({
  points,
  unit,
  goalKg,
  today,
  summary,
}: {
  points: TrendPoint[];
  unit: WeightUnit;
  goalKg: number | null;
  today: string;
  summary: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = points.flatMap((p) => [weightIn(p.kg, unit), weightIn(p.trendKg, unit)]);
  const goal = goalKg != null ? weightIn(goalKg, unit) : null;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  // Show the goal if it is within a few units of the data, not if it would flatten everything.
  const span = Math.max(hi - lo, unit === 'lb' ? 4 : 2);
  const goalShown = goal != null && goal >= lo - span && goal <= hi + span;
  if (goalShown && goal != null) {
    lo = Math.min(lo, goal);
    hi = Math.max(hi, goal);
  }
  const pad = Math.max((hi - lo) * 0.1, unit === 'lb' ? 1 : 0.5);
  lo -= pad;
  hi += pad;

  const first = points.length > 0 ? dayNumber(points[0].day) : 0;
  const last = points.length > 0 ? Math.max(dayNumber(points[points.length - 1].day), first + 1) : 1;
  const plotW = Math.max(1, width - LEFT - RIGHT);
  const x = (day: string) => LEFT + ((dayNumber(day) - first) / (last - first)) * plotW;
  const y = (v: number) => TOP + PLOT_HEIGHT - ((v - lo) / (hi - lo)) * PLOT_HEIGHT;
  const trend = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(weightIn(p.trendKg, unit)).toFixed(1)}`).join(' ');
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary}>
      {width > 0 && points.length > 0 ? (
        <Svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND}>
          <Line x1={LEFT} x2={width - RIGHT} y1={TOP + PLOT_HEIGHT} y2={TOP + PLOT_HEIGHT} stroke={colors.border} strokeWidth={1} />
          <SvgText x={LEFT - 6} y={TOP + 8} fontSize={10} fill={colors.textFaint} textAnchor="end">
            {fmt(hi)}
          </SvgText>
          <SvgText x={LEFT - 6} y={TOP + PLOT_HEIGHT} fontSize={10} fill={colors.textFaint} textAnchor="end">
            {fmt(lo)}
          </SvgText>
          {goalShown && goal != null ? (
            <>
              <Line
                x1={LEFT}
                x2={width - RIGHT}
                y1={y(goal)}
                y2={y(goal)}
                stroke={colors.success}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <SvgText x={LEFT + 4} y={y(goal) - 4} fontSize={10} fill={colors.success}>
                Goal {fmt(goal)}
              </SvgText>
            </>
          ) : null}
          {points.map((p) => (
            <Circle key={p.day} cx={x(p.day)} cy={y(weightIn(p.kg, unit))} r={2.5} fill={colors.textMuted} />
          ))}
          {points.length > 1 ? <Path d={trend} stroke={colors.primary} strokeWidth={2.5} fill="none" /> : null}
          <SvgText x={LEFT} y={TOP + PLOT_HEIGHT + 14} fontSize={10} fill={colors.textFaint}>
            {dayLabel(points[0].day, today)}
          </SvgText>
          {points.length > 1 ? (
            <SvgText x={width - RIGHT} y={TOP + PLOT_HEIGHT + 14} fontSize={10} fill={colors.textFaint} textAnchor="end">
              {dayLabel(points[points.length - 1].day, today)}
            </SvgText>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height: TOP + PLOT_HEIGHT + AXIS_BAND }} />
      )}
    </View>
  );
}
