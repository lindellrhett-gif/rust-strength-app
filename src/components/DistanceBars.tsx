import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { PeriodTotal } from '@/domain/running/history';
import { toUnit, type RunDistanceUnit } from '@/domain/running/units';
import { colors } from '@/theme/colors';

const PLOT_HEIGHT = 120;
const TOP = 18;
const AXIS_BAND = 20;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DistanceBarsProps {
  totals: PeriodTotal[];
  kind: 'week' | 'month';
  unit: RunDistanceUnit;
  /** Drawn as a dashed line on the weekly chart. */
  goalM?: number | null;
}

const label = (period: string, kind: 'week' | 'month') => {
  const [, m, d] = period.split('-').map(Number);
  return kind === 'month' ? MONTHS[m - 1] : `${m}/${d}`;
};

/**
 * Distance per week or month as bars, the current period last and in full
 * colour. VoiceOver reads a summary instead of every bar.
 */
export function DistanceBars({ totals, kind, unit, goalM }: DistanceBarsProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = totals.map((t) => toUnit(t.distanceM, unit));
  const goal = kind === 'week' && goalM ? toUnit(goalM, unit) : null;
  const max = Math.max(1, ...values, goal ?? 0);
  const slot = width / Math.max(1, totals.length);
  const barW = Math.max(4, slot * 0.6);
  const y = (v: number) => TOP + PLOT_HEIGHT - (v / max) * PLOT_HEIGHT;
  const floor = TOP + PLOT_HEIGHT;
  const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));

  const current = values[values.length - 1] ?? 0;
  const best = Math.max(0, ...values);
  const spoken =
    `${kind === 'week' ? 'Weekly' : 'Monthly'} distance for the last ${totals.length} ${kind}s: ` +
    `this ${kind} ${fmt(current)} ${unit}, most ${fmt(best)} ${unit}` +
    (goal != null ? `, goal ${fmt(goal)} ${unit}` : '');
  // Label every bar when there's room, otherwise every third.
  const every = slot >= 34 ? 1 : 3;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={spoken}>
      {width > 0 ? (
        <Svg width={width} height={TOP + PLOT_HEIGHT + AXIS_BAND}>
          <Line x1={0} x2={width} y1={floor} y2={floor} stroke={colors.border} strokeWidth={1} />
          {values.map((v, i) => {
            const isCurrent = i === values.length - 1;
            const x = i * slot + (slot - barW) / 2;
            const h = Math.max(v > 0 ? 2 : 0, floor - y(v));
            const showLabel = (values.length - 1 - i) % every === 0;
            return (
              <G key={totals[i].period}>
                <Rect
                  x={x}
                  y={floor - h}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={colors.primary}
                  fillOpacity={isCurrent ? 1 : 0.45}
                />
                {isCurrent || v === best ? (
                  v > 0 ? (
                    <SvgText x={x + barW / 2} y={floor - h - 4} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                      {fmt(v)}
                    </SvgText>
                  ) : null
                ) : null}
                {showLabel ? (
                  <SvgText x={x + barW / 2} y={floor + 14} fontSize={10} fill={colors.textFaint} textAnchor="middle">
                    {label(totals[i].period, kind)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {goal != null ? (
            <Line
              x1={0}
              x2={width}
              y1={y(goal)}
              y2={y(goal)}
              stroke={colors.success}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ) : null}
        </Svg>
      ) : (
        <View style={{ height: TOP + PLOT_HEIGHT + AXIS_BAND }} />
      )}
    </View>
  );
}
